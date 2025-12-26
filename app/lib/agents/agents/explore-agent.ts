/**
 * Explore Agent - Agent d'exploration en lecture seule
 * Spécialisé dans la recherche et l'analyse de code
 */

import { BaseAgent } from '../core/base-agent';
import { EXPLORE_SYSTEM_PROMPT } from '../prompts/explore-prompt';
import { READ_TOOLS, createReadToolHandlers, type FileSystem } from '../tools/read-tools';
import type {
  Task,
  TaskResult,
  Artifact,
  DEFAULT_MODEL,
} from '../types';

/**
 * Agent d'exploration du codebase
 * Capacités : read_file, grep, glob, list_directory
 * Mode : Lecture seule
 */
export class ExploreAgent extends BaseAgent {
  private fileSystem: FileSystem | null = null;
  private toolHandlers: ReturnType<typeof createReadToolHandlers> | null = null;

  constructor() {
    super({
      name: 'explore',
      description:
        'Agent d\'exploration en LECTURE SEULE. Spécialisé dans la recherche de fichiers, ' +
        'l\'analyse de code, la navigation dans le codebase. ' +
        'Utilise grep, glob, read_file, list_directory.',
      model: 'claude-sonnet-4-5-20250929',
      tools: READ_TOOLS,
      systemPrompt: EXPLORE_SYSTEM_PROMPT,
      maxTokens: 8192,
      temperature: 0.1, // Très déterministe pour l'exploration
      timeout: 120000, // 2 minutes max
      maxRetries: 2,
    });
  }

  /**
   * Initialiser le système de fichiers (WebContainer)
   */
  setFileSystem(fs: FileSystem): void {
    this.fileSystem = fs;
    this.toolHandlers = createReadToolHandlers(fs);
    this.log('info', 'FileSystem initialized for ExploreAgent');
  }

  /**
   * Implémentation du system prompt
   */
  getSystemPrompt(): string {
    return EXPLORE_SYSTEM_PROMPT;
  }

  /**
   * Exécution principale de l'agent
   */
  async execute(task: Task): Promise<TaskResult> {
    if (!this.fileSystem || !this.toolHandlers) {
      return {
        success: false,
        output: 'FileSystem not initialized. Call setFileSystem() first.',
        errors: [
          {
            code: 'NO_FILESYSTEM',
            message: 'FileSystem not initialized',
            recoverable: false,
          },
        ],
      };
    }

    this.log('info', 'Starting exploration task', {
      prompt: task.prompt.substring(0, 100) + '...',
    });

    try {
      // Construire le prompt avec le contexte
      const prompt = this.buildPrompt(task);

      // Exécuter la boucle d'agent
      const result = await this.runAgentLoop(prompt);

      // Enrichir le résultat avec les artifacts
      return this.enrichResult(result);
    } catch (error) {
      this.log('error', 'Exploration failed', { error });
      throw error;
    }
  }

  /**
   * Handler d'exécution des outils
   */
  protected async executeToolHandler(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.toolHandlers) {
      throw new Error('Tool handlers not initialized');
    }

    switch (toolName) {
      case 'read_file':
        return this.toolHandlers.read_file(input as Parameters<typeof this.toolHandlers.read_file>[0]);

      case 'grep':
        return this.toolHandlers.grep(input as Parameters<typeof this.toolHandlers.grep>[0]);

      case 'glob':
        return this.toolHandlers.glob(input as Parameters<typeof this.toolHandlers.glob>[0]);

      case 'list_directory':
        return this.toolHandlers.list_directory(
          input as Parameters<typeof this.toolHandlers.list_directory>[0]
        );

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Construire le prompt complet pour la tâche
   */
  private buildPrompt(task: Task): string {
    let prompt = task.prompt;

    // Ajouter le contexte si disponible
    if (task.context) {
      if (task.context.files && task.context.files.length > 0) {
        prompt += `\n\nFichiers de contexte à considérer:\n${task.context.files.map((f) => `- ${f}`).join('\n')}`;
      }

      if (task.context.workingDirectory) {
        prompt += `\n\nDossier de travail: ${task.context.workingDirectory}`;
      }

      if (task.context.additionalInfo) {
        prompt += `\n\nInformations supplémentaires:\n${JSON.stringify(task.context.additionalInfo, null, 2)}`;
      }
    }

    return prompt;
  }

  /**
   * Enrichir le résultat avec des artifacts structurés
   */
  private enrichResult(result: TaskResult): TaskResult {
    // Extraire les fichiers mentionnés dans la sortie
    const filePatterns = result.output.match(/(?:^|\s)([\w\-./]+\.[a-z]{2,4})(?:\s|$|:|,)/gi);

    if (filePatterns) {
      const artifacts: Artifact[] = filePatterns
        .map((match) => match.trim().replace(/[,:]/g, ''))
        .filter((path) => path.includes('.') && !path.startsWith('http'))
        .map((path) => ({
          type: 'analysis' as const,
          path,
          content: `File referenced in exploration: ${path}`,
          action: 'read' as const,
        }));

      if (artifacts.length > 0) {
        result.artifacts = [...(result.artifacts || []), ...artifacts];
      }
    }

    // Ajouter des données structurées si possible
    try {
      // Chercher du JSON dans la réponse
      const jsonMatch = result.output.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        result.data = JSON.parse(jsonMatch[1]);
      }
    } catch {
      // Ignorer les erreurs de parsing
    }

    return result;
  }
}

/**
 * Factory pour créer un ExploreAgent avec FileSystem
 */
export function createExploreAgent(fs?: FileSystem): ExploreAgent {
  const agent = new ExploreAgent();
  if (fs) {
    agent.setFileSystem(fs);
  }
  return agent;
}
