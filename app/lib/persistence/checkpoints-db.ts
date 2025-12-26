/**
 * Database layer for BAVINI checkpoints (Time Travel feature).
 * Provides CRUD operations for checkpoint persistence.
 */

import type { PGlite } from '@electric-sql/pglite';
import type { Message } from 'ai';
import type { FileMap } from '~/lib/stores/files';
import type { ActionState } from '~/lib/runtime/action-runner';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CheckpointsDB');

/**
 * Trigger type for checkpoint creation.
 */
export type CheckpointTriggerType = 'auto' | 'manual' | 'before_action';

/**
 * Checkpoint data structure.
 */
export interface Checkpoint {
  id: string;
  chatId: string;
  filesSnapshot: FileMap;
  messagesSnapshot: Message[];
  actionsSnapshot?: Record<string, ActionState>;
  description?: string;
  triggerType: CheckpointTriggerType;
  messageId?: string;
  isFullSnapshot: boolean;
  parentCheckpointId?: string;
  compressed: boolean;
  sizeBytes?: number;
  createdAt: string;
}

/**
 * Input for creating a new checkpoint.
 */
export interface CheckpointInput {
  chatId: string;
  filesSnapshot: FileMap;
  messagesSnapshot: Message[];
  actionsSnapshot?: Record<string, ActionState>;
  description?: string;
  triggerType: CheckpointTriggerType;
  messageId?: string;
  parentCheckpointId?: string;
  compressed?: boolean;
}

/**
 * Database row structure for checkpoints.
 */
interface CheckpointRow {
  id: string;
  chat_id: string;
  files_snapshot: string | FileMap;
  messages_snapshot: string | Message[];
  actions_snapshot: string | Record<string, ActionState> | null;
  description: string | null;
  trigger_type: CheckpointTriggerType;
  message_id: string | null;
  is_full_snapshot: boolean;
  parent_checkpoint_id: string | null;
  compressed: boolean;
  size_bytes: number | null;
  created_at: string;
}

/**
 * Generate a unique checkpoint ID.
 */
export function generateCheckpointId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ckpt_${timestamp}_${random}`;
}

/**
 * Convert a database row to a Checkpoint object.
 */
function rowToCheckpoint(row: CheckpointRow): Checkpoint {
  return {
    id: row.id,
    chatId: row.chat_id,
    filesSnapshot: typeof row.files_snapshot === 'string'
      ? JSON.parse(row.files_snapshot)
      : row.files_snapshot,
    messagesSnapshot: typeof row.messages_snapshot === 'string'
      ? JSON.parse(row.messages_snapshot)
      : row.messages_snapshot,
    actionsSnapshot: row.actions_snapshot
      ? (typeof row.actions_snapshot === 'string'
        ? JSON.parse(row.actions_snapshot)
        : row.actions_snapshot)
      : undefined,
    description: row.description ?? undefined,
    triggerType: row.trigger_type,
    messageId: row.message_id ?? undefined,
    isFullSnapshot: row.is_full_snapshot,
    parentCheckpointId: row.parent_checkpoint_id ?? undefined,
    compressed: row.compressed,
    sizeBytes: row.size_bytes ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Calculate the size of a checkpoint in bytes.
 */
function calculateCheckpointSize(input: CheckpointInput): number {
  const filesJson = JSON.stringify(input.filesSnapshot);
  const messagesJson = JSON.stringify(input.messagesSnapshot);
  const actionsJson = input.actionsSnapshot ? JSON.stringify(input.actionsSnapshot) : '';

  return new Blob([filesJson, messagesJson, actionsJson]).size;
}

/**
 * Create a new checkpoint.
 */
export async function createCheckpoint(
  db: PGlite,
  input: CheckpointInput,
): Promise<Checkpoint> {
  const id = generateCheckpointId();
  const now = new Date().toISOString();
  const sizeBytes = calculateCheckpointSize(input);

  logger.debug(`Creating checkpoint ${id} for chat ${input.chatId}`);

  const result = await db.query<CheckpointRow>(
    `INSERT INTO checkpoints (
      id, chat_id, files_snapshot, messages_snapshot, actions_snapshot,
      description, trigger_type, message_id, is_full_snapshot,
      parent_checkpoint_id, compressed, size_bytes, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      id,
      input.chatId,
      JSON.stringify(input.filesSnapshot),
      JSON.stringify(input.messagesSnapshot),
      input.actionsSnapshot ? JSON.stringify(input.actionsSnapshot) : null,
      input.description ?? null,
      input.triggerType,
      input.messageId ?? null,
      !input.parentCheckpointId, // is_full_snapshot if no parent
      input.parentCheckpointId ?? null,
      input.compressed ?? false,
      sizeBytes,
      now,
    ],
  );

  const checkpoint = rowToCheckpoint(result.rows[0]);

  logger.info(`Checkpoint ${id} created (${sizeBytes} bytes)`);

  return checkpoint;
}

/**
 * Get all checkpoints for a chat, ordered by creation date (newest first).
 */
export async function getCheckpointsByChat(
  db: PGlite,
  chatId: string,
  limit?: number,
): Promise<Checkpoint[]> {
  const query = limit
    ? 'SELECT * FROM checkpoints WHERE chat_id = $1 ORDER BY created_at DESC LIMIT $2'
    : 'SELECT * FROM checkpoints WHERE chat_id = $1 ORDER BY created_at DESC';

  const params = limit ? [chatId, limit] : [chatId];
  const result = await db.query<CheckpointRow>(query, params);

  return result.rows.map(rowToCheckpoint);
}

/**
 * Get a checkpoint by ID.
 */
export async function getCheckpointById(
  db: PGlite,
  id: string,
): Promise<Checkpoint | null> {
  const result = await db.query<CheckpointRow>(
    'SELECT * FROM checkpoints WHERE id = $1',
    [id],
  );

  return result.rows[0] ? rowToCheckpoint(result.rows[0]) : null;
}

/**
 * Get the latest checkpoint for a chat.
 */
export async function getLatestCheckpoint(
  db: PGlite,
  chatId: string,
): Promise<Checkpoint | null> {
  const result = await db.query<CheckpointRow>(
    'SELECT * FROM checkpoints WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 1',
    [chatId],
  );

  return result.rows[0] ? rowToCheckpoint(result.rows[0]) : null;
}

/**
 * Get checkpoints by trigger type.
 */
export async function getCheckpointsByTrigger(
  db: PGlite,
  chatId: string,
  triggerType: CheckpointTriggerType,
): Promise<Checkpoint[]> {
  const result = await db.query<CheckpointRow>(
    'SELECT * FROM checkpoints WHERE chat_id = $1 AND trigger_type = $2 ORDER BY created_at DESC',
    [chatId, triggerType],
  );

  return result.rows.map(rowToCheckpoint);
}

/**
 * Delete a checkpoint by ID.
 */
export async function deleteCheckpoint(
  db: PGlite,
  id: string,
): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM checkpoints WHERE id = $1',
    [id],
  );

  const deleted = (result.affectedRows ?? 0) > 0;

  if (deleted) {
    logger.info(`Checkpoint ${id} deleted`);
  }

  return deleted;
}

/**
 * Delete all checkpoints for a chat.
 */
export async function deleteCheckpointsByChat(
  db: PGlite,
  chatId: string,
): Promise<number> {
  const result = await db.query(
    'DELETE FROM checkpoints WHERE chat_id = $1',
    [chatId],
  );

  const count = result.affectedRows ?? 0;

  logger.info(`Deleted ${count} checkpoints for chat ${chatId}`);

  return count;
}

/**
 * Delete old checkpoints, keeping the most recent N.
 */
export async function deleteOldCheckpoints(
  db: PGlite,
  chatId: string,
  keepCount: number,
  options: {
    preserveManual?: boolean;
  } = {},
): Promise<number> {
  const { preserveManual = true } = options;

  // get IDs to keep (most recent)
  const keepQuery = preserveManual
    ? `SELECT id FROM checkpoints WHERE chat_id = $1
       AND (trigger_type = 'manual' OR id IN (
         SELECT id FROM checkpoints WHERE chat_id = $1
         ORDER BY created_at DESC LIMIT $2
       ))`
    : `SELECT id FROM checkpoints WHERE chat_id = $1
       ORDER BY created_at DESC LIMIT $2`;

  const keepResult = await db.query<{ id: string }>(keepQuery, [chatId, keepCount]);
  const keepIds = keepResult.rows.map(r => r.id);

  if (keepIds.length === 0) {
    return 0;
  }

  // delete all except those to keep
  const placeholders = keepIds.map((_, i) => `$${i + 2}`).join(', ');
  const deleteResult = await db.query(
    `DELETE FROM checkpoints WHERE chat_id = $1 AND id NOT IN (${placeholders})`,
    [chatId, ...keepIds],
  );

  const count = deleteResult.affectedRows ?? 0;

  if (count > 0) {
    logger.info(`Cleaned up ${count} old checkpoints for chat ${chatId}`);
  }

  return count;
}

/**
 * Get the total number of checkpoints for a chat.
 */
export async function getCheckpointCount(
  db: PGlite,
  chatId: string,
): Promise<number> {
  const result = await db.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM checkpoints WHERE chat_id = $1',
    [chatId],
  );

  return parseInt(result.rows[0]?.count ?? '0', 10);
}

/**
 * Get the total size of all checkpoints for a chat in bytes.
 */
export async function getCheckpointsTotalSize(
  db: PGlite,
  chatId: string,
): Promise<number> {
  const result = await db.query<{ total: string | null }>(
    'SELECT SUM(size_bytes) as total FROM checkpoints WHERE chat_id = $1',
    [chatId],
  );

  return parseInt(result.rows[0]?.total ?? '0', 10);
}

/**
 * Update a checkpoint's description.
 */
export async function updateCheckpointDescription(
  db: PGlite,
  id: string,
  description: string,
): Promise<boolean> {
  const result = await db.query(
    'UPDATE checkpoints SET description = $1 WHERE id = $2',
    [description, id],
  );

  return (result.affectedRows ?? 0) > 0;
}

/**
 * Check if a checkpoint exists.
 */
export async function checkpointExists(
  db: PGlite,
  id: string,
): Promise<boolean> {
  const result = await db.query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM checkpoints WHERE id = $1) as exists',
    [id],
  );

  return result.rows[0]?.exists ?? false;
}

/**
 * Get checkpoints created within a time range.
 */
export async function getCheckpointsByTimeRange(
  db: PGlite,
  chatId: string,
  startTime: Date,
  endTime: Date,
): Promise<Checkpoint[]> {
  const result = await db.query<CheckpointRow>(
    `SELECT * FROM checkpoints
     WHERE chat_id = $1 AND created_at >= $2 AND created_at <= $3
     ORDER BY created_at DESC`,
    [chatId, startTime.toISOString(), endTime.toISOString()],
  );

  return result.rows.map(rowToCheckpoint);
}
