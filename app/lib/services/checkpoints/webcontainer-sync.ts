/**
 * WebContainer synchronization for checkpoint restoration.
 * Handles writing/deleting files to match a checkpoint snapshot.
 */

import type { WebContainer } from '@webcontainer/api';
import type { FileMap, File } from '~/lib/stores/files';
import { createScopedLogger } from '~/utils/logger';
import { WORK_DIR } from '~/utils/constants';
import * as nodePath from 'node:path';

const logger = createScopedLogger('CheckpointSync');

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  success: boolean;
  filesWritten: number;
  filesDeleted: number;
  foldersCreated: number;
  errors: SyncError[];
  durationMs: number;
}

/**
 * Error during sync operation.
 */
export interface SyncError {
  path: string;
  operation: 'write' | 'delete' | 'mkdir';
  error: string;
}

/**
 * Options for sync operation.
 */
export interface SyncOptions {
  /** Delete files that exist in WebContainer but not in snapshot */
  deleteExtraFiles?: boolean;

  /** Create parent directories if they don't exist */
  createDirectories?: boolean;

  /** Paths to exclude from sync */
  excludePaths?: string[];

  /** Callback for progress updates */
  onProgress?: (current: number, total: number, path: string) => void;
}

const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  deleteExtraFiles: true,
  createDirectories: true,
  excludePaths: ['node_modules', '.git', '.cache'],
};

/**
 * Sync WebContainer files to match a checkpoint snapshot.
 */
export async function syncToSnapshot(
  webcontainer: WebContainer,
  snapshot: FileMap,
  currentFiles: FileMap,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };
  const startTime = Date.now();

  const result: SyncResult = {
    success: true,
    filesWritten: 0,
    filesDeleted: 0,
    foldersCreated: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    // Get files to write and delete
    const { toWrite, toDelete } = calculateDiff(snapshot, currentFiles, opts.excludePaths ?? []);

    const totalOperations = toWrite.length + toDelete.length;
    let completed = 0;

    // Create necessary directories first
    if (opts.createDirectories) {
      const directories = getRequiredDirectories(toWrite);

      for (const dir of directories) {
        try {
          await ensureDirectory(webcontainer, dir);
          result.foldersCreated++;
        } catch (error) {
          result.errors.push({
            path: dir,
            operation: 'mkdir',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // Write new/modified files
    for (const path of toWrite) {
      try {
        const file = snapshot[path];

        if (file?.type === 'file') {
          await writeFile(webcontainer, path, file);
          result.filesWritten++;
        }

        completed++;
        opts.onProgress?.(completed, totalOperations, path);
      } catch (error) {
        result.errors.push({
          path,
          operation: 'write',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Delete extra files
    if (opts.deleteExtraFiles) {
      for (const path of toDelete) {
        try {
          await deleteFile(webcontainer, path);
          result.filesDeleted++;

          completed++;
          opts.onProgress?.(completed, totalOperations, path);
        } catch (error) {
          result.errors.push({
            path,
            operation: 'delete',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    result.success = result.errors.length === 0;
  } catch (error) {
    logger.error('Sync failed:', error);
    result.success = false;
    result.errors.push({
      path: '',
      operation: 'write',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  result.durationMs = Date.now() - startTime;

  logger.info(
    `Sync completed: ${result.filesWritten} written, ${result.filesDeleted} deleted, ` +
      `${result.foldersCreated} dirs created, ${result.errors.length} errors in ${result.durationMs}ms`,
  );

  return result;
}

/**
 * Calculate the diff between snapshot and current files.
 */
export function calculateDiff(
  snapshot: FileMap,
  current: FileMap,
  excludePaths: string[],
): { toWrite: string[]; toDelete: string[] } {
  const toWrite: string[] = [];
  const toDelete: string[] = [];

  // Find files to write (new or modified)
  for (const [path, dirent] of Object.entries(snapshot)) {
    if (dirent?.type !== 'file') continue;
    if (shouldExclude(path, excludePaths)) continue;

    const currentFile = current[path];

    if (!currentFile || currentFile.type !== 'file' || currentFile.content !== dirent.content) {
      toWrite.push(path);
    }
  }

  // Find files to delete (in current but not in snapshot)
  for (const [path, dirent] of Object.entries(current)) {
    if (dirent?.type !== 'file') continue;
    if (shouldExclude(path, excludePaths)) continue;

    if (!snapshot[path]) {
      toDelete.push(path);
    }
  }

  return { toWrite, toDelete };
}

/**
 * Check if a path should be excluded.
 */
function shouldExclude(path: string, excludePaths: string[]): boolean {
  return excludePaths.some((excluded) => path.includes(`/${excluded}/`) || path.endsWith(`/${excluded}`));
}

/**
 * Get all directories that need to be created.
 */
function getRequiredDirectories(filePaths: string[]): string[] {
  const directories = new Set<string>();

  for (const filePath of filePaths) {
    const parts = filePath.split('/').slice(0, -1);
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (currentPath.startsWith(WORK_DIR)) {
        directories.add(currentPath);
      }
    }
  }

  // Sort by depth (shortest first) to create parent dirs before children
  return Array.from(directories).sort((a, b) => a.split('/').length - b.split('/').length);
}

/**
 * Ensure a directory exists in WebContainer.
 */
async function ensureDirectory(webcontainer: WebContainer, absolutePath: string): Promise<void> {
  const relativePath = nodePath.relative(webcontainer.workdir, absolutePath);

  if (!relativePath) return;

  try {
    await webcontainer.fs.mkdir(relativePath, { recursive: true });
  } catch (error) {
    // Directory might already exist
    if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Write a file to WebContainer.
 */
async function writeFile(webcontainer: WebContainer, absolutePath: string, file: File): Promise<void> {
  const relativePath = nodePath.relative(webcontainer.workdir, absolutePath);

  if (!relativePath) {
    throw new Error(`Invalid path: ${absolutePath}`);
  }

  // Skip binary files
  if (file.isBinary) {
    logger.debug(`Skipping binary file: ${relativePath}`);
    return;
  }

  await webcontainer.fs.writeFile(relativePath, file.content);
  logger.debug(`Written: ${relativePath}`);
}

/**
 * Delete a file from WebContainer.
 */
async function deleteFile(webcontainer: WebContainer, absolutePath: string): Promise<void> {
  const relativePath = nodePath.relative(webcontainer.workdir, absolutePath);

  if (!relativePath) {
    throw new Error(`Invalid path: ${absolutePath}`);
  }

  try {
    await webcontainer.fs.rm(relativePath);
    logger.debug(`Deleted: ${relativePath}`);
  } catch (error) {
    // File might not exist
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Get a summary of what would be synced without actually syncing.
 */
export function previewSync(
  snapshot: FileMap,
  current: FileMap,
  excludePaths: string[] = [],
): { toWrite: string[]; toDelete: string[]; unchanged: number } {
  const { toWrite, toDelete } = calculateDiff(snapshot, current, excludePaths);

  const snapshotFiles = Object.entries(snapshot).filter(([_, d]) => d?.type === 'file').length;
  const unchanged = snapshotFiles - toWrite.length;

  return { toWrite, toDelete, unchanged };
}
