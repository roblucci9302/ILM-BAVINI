/**
 * Outils de lecture pour les agents BAVINI
 * Ces outils permettent d'explorer le codebase en lecture seule
 */

import type { ToolDefinition, ToolExecutionResult } from '../types';

/*
 * ============================================================================
 * DÉFINITIONS DES OUTILS
 * ============================================================================
 */

/**
 * Outil pour lire le contenu d'un fichier
 */
export const ReadFileTool: ToolDefinition = {
  name: 'read_file',
  description:
    "Lire le contenu d'un fichier. Retourne le contenu avec les numéros de ligne. " +
    'Peut lire une portion du fichier avec startLine et endLine.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Chemin du fichier à lire (relatif au projet)',
      },
      startLine: {
        type: 'number',
        description: 'Ligne de début (1-indexed, optionnel)',
      },
      endLine: {
        type: 'number',
        description: 'Ligne de fin (1-indexed, optionnel)',
      },
    },
    required: ['path'],
  },
};

/**
 * Outil pour rechercher des patterns dans les fichiers
 */
export const GrepTool: ToolDefinition = {
  name: 'grep',
  description:
    'Rechercher un pattern (regex) dans les fichiers. ' + 'Retourne les lignes correspondantes avec le contexte.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Pattern regex à rechercher',
      },
      path: {
        type: 'string',
        description: 'Dossier où chercher (défaut: racine du projet)',
      },
      filePattern: {
        type: 'string',
        description: 'Pattern glob pour filtrer les fichiers (ex: "*.ts", "*.tsx")',
      },
      maxResults: {
        type: 'number',
        description: 'Nombre maximum de résultats (défaut: 50)',
      },
      contextLines: {
        type: 'number',
        description: 'Nombre de lignes de contexte avant/après (défaut: 2)',
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Recherche sensible à la casse (défaut: false)',
      },
    },
    required: ['pattern'],
  },
};

/**
 * Outil pour trouver des fichiers par pattern glob
 */
export const GlobTool: ToolDefinition = {
  name: 'glob',
  description:
    'Trouver des fichiers correspondant à un pattern glob. ' + 'Exemples: "**/*.ts", "src/**/*.tsx", "*.json"',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Pattern glob (ex: "**/*.ts", "src/**/*.tsx")',
      },
      cwd: {
        type: 'string',
        description: 'Dossier de base (défaut: racine du projet)',
      },
      ignore: {
        type: 'array',
        description: 'Patterns à ignorer (ex: ["node_modules/**", "dist/**"])',
        items: { type: 'string' },
      },
      maxResults: {
        type: 'number',
        description: 'Nombre maximum de résultats (défaut: 100)',
      },
    },
    required: ['pattern'],
  },
};

/**
 * Outil pour lister le contenu d'un dossier
 */
export const ListDirectoryTool: ToolDefinition = {
  name: 'list_directory',
  description:
    "Lister le contenu d'un dossier. Retourne les fichiers et sous-dossiers " +
    'avec leurs métadonnées (type, taille).',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Chemin du dossier à lister (défaut: racine)',
      },
      recursive: {
        type: 'boolean',
        description: 'Lister récursivement les sous-dossiers (défaut: false)',
      },
      maxDepth: {
        type: 'number',
        description: 'Profondeur maximale si récursif (défaut: 3)',
      },
      includeHidden: {
        type: 'boolean',
        description: 'Inclure les fichiers cachés (défaut: false)',
      },
    },
    required: [],
  },
};

/*
 * ============================================================================
 * HANDLERS D'EXÉCUTION
 * ============================================================================
 */

/**
 * Interface pour le système de fichiers (abstraction pour WebContainer)
 */
export interface FileSystem {
  readFile(path: string): Promise<string>;
  readdir(path: string): Promise<Array<{ name: string; isDirectory: boolean; size?: number }>>;
  exists(path: string): Promise<boolean>;
}

/**
 * Créer les handlers pour les outils de lecture
 */
export function createReadToolHandlers(fs: FileSystem) {
  return {
    /**
     * Handler pour read_file
     */
    async read_file(input: { path: string; startLine?: number; endLine?: number }): Promise<ToolExecutionResult> {
      try {
        const content = await fs.readFile(input.path);
        const lines = content.split('\n');

        let start = input.startLine ? input.startLine - 1 : 0;
        let end = input.endLine ? input.endLine : lines.length;

        // Valider les bornes
        start = Math.max(0, start);
        end = Math.min(lines.length, end);

        // Extraire les lignes demandées avec numéros
        const selectedLines = lines.slice(start, end).map((line, idx) => {
          const lineNum = start + idx + 1;
          return `${lineNum.toString().padStart(4)}\t${line}`;
        });

        return {
          success: true,
          output: {
            path: input.path,
            totalLines: lines.length,
            startLine: start + 1,
            endLine: end,
            content: selectedLines.join('\n'),
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Failed to read file ${input.path}: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Handler pour grep
     */
    async grep(input: {
      pattern: string;
      path?: string;
      filePattern?: string;
      maxResults?: number;
      contextLines?: number;
      caseSensitive?: boolean;
    }): Promise<ToolExecutionResult> {
      try {
        const maxResults = input.maxResults || 50;
        const contextLines = input.contextLines || 2;
        const flags = input.caseSensitive ? 'g' : 'gi';

        const regex = new RegExp(input.pattern, flags);
        const results: Array<{
          file: string;
          line: number;
          content: string;
          context: string[];
        }> = [];

        // Fonction récursive pour parcourir les fichiers
        const searchInDirectory = async (dirPath: string) => {
          if (results.length >= maxResults) {
            return;
          }

          const entries = await fs.readdir(dirPath);

          for (const entry of entries) {
            if (results.length >= maxResults) {
              break;
            }

            const fullPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;

            // Ignorer node_modules et autres
            if (
              entry.name === 'node_modules' ||
              entry.name === '.git' ||
              entry.name === 'dist' ||
              entry.name === 'build'
            ) {
              continue;
            }

            if (entry.isDirectory) {
              await searchInDirectory(fullPath);
            } else {
              // Vérifier le pattern de fichier
              if (input.filePattern) {
                const fileRegex = new RegExp(input.filePattern.replace(/\*/g, '.*').replace(/\?/g, '.'));

                if (!fileRegex.test(entry.name)) {
                  continue;
                }
              }

              try {
                const content = await fs.readFile(fullPath);
                const lines = content.split('\n');

                for (let i = 0; i < lines.length && results.length < maxResults; i++) {
                  if (regex.test(lines[i])) {
                    // Extraire le contexte
                    const contextStart = Math.max(0, i - contextLines);
                    const contextEnd = Math.min(lines.length, i + contextLines + 1);
                    const context = lines.slice(contextStart, contextEnd).map((l, idx) => {
                      const lineNum = contextStart + idx + 1;
                      const marker = lineNum === i + 1 ? '>' : ' ';

                      return `${marker}${lineNum.toString().padStart(4)}\t${l}`;
                    });

                    results.push({
                      file: fullPath,
                      line: i + 1,
                      content: lines[i],
                      context,
                    });
                  }
                }
              } catch {
                // Ignorer les fichiers illisibles
              }
            }
          }
        };

        await searchInDirectory(input.path || '');

        return {
          success: true,
          output: {
            pattern: input.pattern,
            totalMatches: results.length,
            results,
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Grep failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Handler pour glob
     */
    async glob(input: {
      pattern: string;
      cwd?: string;
      ignore?: string[];
      maxResults?: number;
    }): Promise<ToolExecutionResult> {
      try {
        const maxResults = input.maxResults || 100;
        const ignorePatterns = input.ignore || ['node_modules/**', '.git/**', 'dist/**'];
        const matches: string[] = [];

        // Convertir le pattern glob en regex
        const patternParts = input.pattern.split('/');
        const regexPattern = patternParts
          .map((part) => {
            if (part === '**') {
              return '.*';
            }

            return part.replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]');
          })
          .join('/');

        const regex = new RegExp(`^${regexPattern}$`);

        // Fonction pour vérifier si un chemin doit être ignoré
        const shouldIgnore = (path: string): boolean => {
          for (const ignorePattern of ignorePatterns) {
            const ignoreRegex = new RegExp(ignorePattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));

            if (ignoreRegex.test(path)) {
              return true;
            }
          }
          return false;
        };

        // Fonction récursive pour parcourir
        const searchDirectory = async (dirPath: string) => {
          if (matches.length >= maxResults) {
            return;
          }

          const entries = await fs.readdir(dirPath);

          for (const entry of entries) {
            if (matches.length >= maxResults) {
              break;
            }

            const fullPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;

            if (shouldIgnore(fullPath)) {
              continue;
            }

            if (entry.isDirectory) {
              await searchDirectory(fullPath);
            } else {
              if (regex.test(fullPath)) {
                matches.push(fullPath);
              }
            }
          }
        };

        await searchDirectory(input.cwd || '');

        return {
          success: true,
          output: {
            pattern: input.pattern,
            totalMatches: matches.length,
            files: matches,
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `Glob failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    /**
     * Handler pour list_directory
     */
    async list_directory(input: {
      path?: string;
      recursive?: boolean;
      maxDepth?: number;
      includeHidden?: boolean;
    }): Promise<ToolExecutionResult> {
      try {
        const maxDepth = input.maxDepth || 3;

        interface DirEntry {
          name: string;
          path: string;
          type: 'file' | 'directory';
          size?: number;
          children?: DirEntry[];
        }

        const listDir = async (dirPath: string, depth: number): Promise<DirEntry[]> => {
          const entries = await fs.readdir(dirPath);
          const result: DirEntry[] = [];

          for (const entry of entries) {
            // Filtrer les fichiers cachés si demandé
            if (!input.includeHidden && entry.name.startsWith('.')) {
              continue;
            }

            // Ignorer node_modules par défaut
            if (entry.name === 'node_modules') {
              continue;
            }

            const fullPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;

            const dirEntry: DirEntry = {
              name: entry.name,
              path: fullPath,
              type: entry.isDirectory ? 'directory' : 'file',
              size: entry.size,
            };

            if (entry.isDirectory && input.recursive && depth < maxDepth) {
              dirEntry.children = await listDir(fullPath, depth + 1);
            }

            result.push(dirEntry);
          }

          // Trier: dossiers d'abord, puis fichiers
          return result.sort((a, b) => {
            if (a.type === b.type) {
              return a.name.localeCompare(b.name);
            }

            return a.type === 'directory' ? -1 : 1;
          });
        };

        const entries = await listDir(input.path || '', 0);

        return {
          success: true,
          output: {
            path: input.path || '.',
            recursive: input.recursive || false,
            entries,
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `List directory failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}

/*
 * ============================================================================
 * EXPORT
 * ============================================================================
 */

/**
 * Tous les outils de lecture
 */
export const READ_TOOLS: ToolDefinition[] = [ReadFileTool, GrepTool, GlobTool, ListDirectoryTool];
