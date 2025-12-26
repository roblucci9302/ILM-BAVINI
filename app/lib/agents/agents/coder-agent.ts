/**
 * Coder Agent - Agent spécialisé dans l'écriture et la modification de code
 * Combine les outils de lecture et d'écriture pour des modifications précises
 */

import { BaseAgent } from '../core/base-agent';
import { READ_TOOLS, createReadToolHandlers } from '../tools/read-tools';
import {
  WRITE_TOOLS,
  createWriteToolHandlers,
  type WritableFileSystem,
} from '../tools/write-tools';
import { CODER_SYSTEM_PROMPT } from '../prompts/coder-prompt';
import type { Task, TaskResult, ToolDefinition, Artifact } from '../types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CoderAgent');

// ============================================================================
// TYPE FILESYSTEM POUR CODER
// ============================================================================

/**
 * Type pour le système de fichiers complet (lecture + écriture)
 * WritableFileSystem inclut déjà toutes les méthodes nécessaires
 */
export type CoderFileSystem = WritableFileSystem;

// ============================================================================
// CODER AGENT
// ============================================================================

/**
 * Agent de développement pour l'écriture de code
 */
export class CoderAgent extends BaseAgent {
  private fileSystem: CoderFileSystem | null = null;
  private readHandlers: ReturnType<typeof createReadToolHandlers> | null = null;
  private writeHandlers: ReturnType<typeof createWriteToolHandlers> | null = null;
  private modifiedFiles: Map<string, { action: string; content?: string }> = new Map();

  constructor() {
    super({
      name: 'coder',
      description:
        'Agent de développement. Peut créer, modifier, et supprimer des fichiers de code. ' +
        'Spécialisé dans l\'écriture de code propre et fonctionnel.',
      model: 'claude-sonnet-4-5-20250929',
      tools: [...READ_TOOLS, ...WRITE_TOOLS],
      systemPrompt: CODER_SYSTEM_PROMPT,
      maxTokens: 8192,
      temperature: 0.1, // Plus déterministe pour le code
    });
  }

  /**
   * Implémentation du system prompt
   */
  getSystemPrompt(): string {
    return CODER_SYSTEM_PROMPT;
  }

  /**
   * Exécution principale de l'agent (appelée par run())
   */
  async execute(task: Task): Promise<TaskResult> {
    // Vérifier que le FileSystem est initialisé
    if (!this.fileSystem || !this.readHandlers || !this.writeHandlers) {
      return {
        success: false,
        output: 'FileSystem not initialized. Call setFileSystem() first.',
        errors: [
          {
            code: 'FS_NOT_INITIALIZED',
            message: 'FileSystem not initialized',
            recoverable: false,
          },
        ],
      };
    }

    // Réinitialiser les fichiers modifiés
    this.modifiedFiles.clear();

    // Construire le prompt avec contexte
    let prompt = task.prompt;

    if (task.context?.files && task.context.files.length > 0) {
      prompt += '\n\nFichiers pertinents:\n';

      for (const file of task.context.files) {
        prompt += `- ${file}\n`;
      }
    }

    if (task.context?.codeSnippets && task.context.codeSnippets.length > 0) {
      prompt += '\n\nExtraits de code fournis:\n';

      for (const snippet of task.context.codeSnippets) {
        prompt += `\n### ${snippet.filePath} (lignes ${snippet.startLine}-${snippet.endLine})\n`;
        prompt += '```' + (snippet.language || '') + '\n';
        prompt += snippet.content;
        prompt += '\n```\n';
      }
    }

    // Exécuter la boucle d'agent
    const result = await this.runAgentLoop(prompt);

    // Ajouter les artefacts des fichiers modifiés
    if (result.success && this.modifiedFiles.size > 0) {
      result.artifacts = result.artifacts || [];

      for (const [path, info] of this.modifiedFiles) {
        const artifact: Artifact = {
          type: 'file',
          path,
          action: info.action as 'created' | 'modified' | 'deleted',
          content: info.content || '',
          title: `${info.action}: ${path}`,
        };
        result.artifacts.push(artifact);
      }
    }

    return result;
  }

  /**
   * Initialiser le système de fichiers
   */
  setFileSystem(fs: CoderFileSystem): void {
    this.fileSystem = fs;
    this.readHandlers = createReadToolHandlers(fs);
    this.writeHandlers = createWriteToolHandlers(fs);
    this.log('info', 'FileSystem initialized for CoderAgent');
  }

  /**
   * Obtenir les fichiers modifiés lors de la dernière exécution
   */
  getModifiedFiles(): Map<string, { action: string; content?: string }> {
    return new Map(this.modifiedFiles);
  }

  /**
   * Handler pour l'exécution des outils
   */
  protected async executeToolHandler(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    // Outils de lecture
    if (this.readHandlers && toolName in this.readHandlers) {
      const handler = this.readHandlers[toolName as keyof typeof this.readHandlers];
      // Cast input to any for type flexibility with tool handlers
      const result = await handler(input as any);

      if (!result.success) {
        throw new Error(result.error || 'Read tool failed');
      }

      return result.output;
    }

    // Outils d'écriture
    if (this.writeHandlers && toolName in this.writeHandlers) {
      const handler = this.writeHandlers[toolName as keyof typeof this.writeHandlers];
      const result = await handler(input);

      if (!result.success) {
        throw new Error(result.error || 'Write tool failed');
      }

      // Tracker les modifications
      this.trackFileModification(toolName, input);

      return result.output;
    }

    throw new Error(`Unknown tool: ${toolName}`);
  }

  /**
   * Tracker les modifications de fichiers
   */
  private trackFileModification(toolName: string, input: Record<string, unknown>): void {
    switch (toolName) {
      case 'write_file':
        this.modifiedFiles.set(input.path as string, {
          action: 'created',
          content: input.content as string,
        });
        break;

      case 'edit_file':
        this.modifiedFiles.set(input.path as string, {
          action: 'modified',
        });
        break;

      case 'delete_file':
        this.modifiedFiles.set(input.path as string, {
          action: 'deleted',
        });
        break;

      case 'move_file':
        this.modifiedFiles.set(input.oldPath as string, {
          action: 'deleted',
        });
        this.modifiedFiles.set(input.newPath as string, {
          action: 'created',
        });
        break;
    }
  }

  /**
   * Obtenir la liste des outils disponibles
   */
  getAvailableTools(): ToolDefinition[] {
    return this.config.tools;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Créer une instance du Coder Agent
 */
export function createCoderAgent(fs?: CoderFileSystem): CoderAgent {
  const agent = new CoderAgent();

  if (fs) {
    agent.setFileSystem(fs);
  }

  return agent;
}
