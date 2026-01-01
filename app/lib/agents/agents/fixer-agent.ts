/**
 * Fixer Agent - Agent spécialisé dans la correction automatique d'erreurs
 * Corrige les erreurs de test, compilation, et problèmes de qualité
 */

import { BaseAgent } from '../core/base-agent';
import type { ToolHandler } from '../core/tool-registry';
import { READ_TOOLS, createReadToolHandlers, type FileSystem } from '../tools/read-tools';
import { WRITE_TOOLS, createWriteToolHandlers, type WritableFileSystem } from '../tools/write-tools';
import { FIXER_SYSTEM_PROMPT } from '../prompts/fixer-prompt';
import type { Task, TaskResult, ToolDefinition, Artifact, AgentError, ToolExecutionResult } from '../types';
import { getModelForAgent } from '../types';
import type { CodeIssue } from '../tools/review-tools';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('FixerAgent');

/*
 * ============================================================================
 * TYPES
 * ============================================================================
 */

/**
 * Type d'erreur à corriger
 */
export type FixableErrorType = 'test_failure' | 'compilation' | 'security' | 'quality' | 'lint';

/**
 * Erreur à corriger
 */
export interface FixableError {
  type: FixableErrorType;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stack?: string;
  code?: string;
  severity?: 'high' | 'medium' | 'low';
}

/**
 * Correction appliquée
 */
export interface AppliedFix {
  file: string;
  action: 'edit' | 'create' | 'delete';
  description: string;
  before?: string;
  after?: string;
  linesAffected?: number[];
}

/**
 * Résultat de correction
 */
export interface FixResult {
  success: boolean;
  error: FixableError;
  corrections: AppliedFix[];
  explanation: string;
  verification?: string;
  potentialImpacts?: string[];
}

/*
 * ============================================================================
 * FIXER AGENT
 * ============================================================================
 */

/**
 * Agent de correction automatique
 */
export class FixerAgent extends BaseAgent {
  private fileSystem: WritableFileSystem | null = null;
  private fixHistory: Array<{
    timestamp: Date;
    file: string;
    errorType: FixableErrorType;
    success: boolean;
  }> = [];
  private appliedFixes: AppliedFix[] = [];

  constructor() {
    super({
      name: 'fixer',
      description:
        'Agent de correction automatique. Corrige les erreurs de test, de compilation, ' +
        'et les problèmes de sécurité ou qualité identifiés par les autres agents.',
      model: getModelForAgent('fixer'), // Opus 4.5 pour correction intelligente
      tools: [...READ_TOOLS, ...WRITE_TOOLS],
      systemPrompt: FIXER_SYSTEM_PROMPT,
      maxTokens: 8192,
      temperature: 0.1, // Très déterministe pour les corrections
    });
  }

  /**
   * Implémentation du system prompt
   */
  getSystemPrompt(): string {
    return FIXER_SYSTEM_PROMPT;
  }

  /**
   * Exécution principale de l'agent (appelée par run())
   */
  async execute(task: Task): Promise<TaskResult> {
    // Vérifier que le FileSystem est initialisé
    if (!this.fileSystem) {
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

    // Réinitialiser les corrections appliquées
    this.appliedFixes = [];

    // Construire le prompt avec le contexte d'erreur
    let prompt = task.prompt;

    // Ajouter les erreurs spécifiques si fournies dans le contexte
    if (task.context?.errors && Array.isArray(task.context.errors)) {
      prompt += '\n\nErreurs à corriger:\n';

      for (const error of task.context.errors as FixableError[]) {
        prompt += `\n### Erreur (${error.type})`;

        if (error.file) {
          prompt += ` dans ${error.file}`;
        }

        if (error.line) {
          prompt += `:${error.line}`;
        }

        prompt += `\nMessage: ${error.message}`;

        if (error.stack) {
          prompt += `\nStack trace:\n\`\`\`\n${error.stack}\n\`\`\``;
        }

        if (error.code) {
          prompt += `\nCode problématique:\n\`\`\`\n${error.code}\n\`\`\``;
        }
      }
    }

    // Ajouter les issues de review si fournies
    if (task.context?.reviewIssues && Array.isArray(task.context.reviewIssues)) {
      prompt += '\n\nProblèmes identifiés par la review:\n';

      for (const issue of task.context.reviewIssues as CodeIssue[]) {
        prompt += `\n- [${issue.severity}] ${issue.type} dans ${issue.file}`;

        if (issue.line) {
          prompt += `:${issue.line}`;
        }

        prompt += `: ${issue.message}`;

        if (issue.suggestion) {
          prompt += `\n  Suggestion: ${issue.suggestion}`;
        }
      }
    }

    // Ajouter l'historique des corrections récentes
    if (this.fixHistory.length > 0) {
      const recent = this.fixHistory.slice(-5);
      prompt += '\n\nHistorique récent des corrections:\n';

      for (const entry of recent) {
        const status = entry.success ? '✓' : '✗';
        prompt += `- ${entry.timestamp.toISOString()}: ${status} ${entry.errorType} dans ${entry.file}\n`;
      }
    }

    // Exécuter la boucle d'agent
    const result = await this.runAgentLoop(prompt);

    // Ajouter les artefacts des corrections
    if (this.appliedFixes.length > 0) {
      result.artifacts = result.artifacts || [];

      for (const fix of this.appliedFixes) {
        const artifact: Artifact = {
          type: 'file',
          path: fix.file,
          action: fix.action === 'create' ? 'created' : fix.action === 'delete' ? 'deleted' : 'modified',
          content: fix.after || '',
          title: `${fix.action}: ${fix.file} - ${fix.description}`,
        };
        result.artifacts.push(artifact);
      }

      // Ajouter un résumé des corrections
      const summaryArtifact: Artifact = {
        type: 'message',
        content: JSON.stringify(
          {
            totalFixes: this.appliedFixes.length,
            fixes: this.appliedFixes,
          },
          null,
          2,
        ),
        title: 'Fix Summary',
      };
      result.artifacts.push(summaryArtifact);
    }

    return result;
  }

  /**
   * Initialiser le système de fichiers
   * Enregistre les outils de lecture et d'écriture dans le ToolRegistry
   */
  setFileSystem(fs: WritableFileSystem): void {
    this.fileSystem = fs;

    // Enregistrer les outils de lecture
    const readHandlers = createReadToolHandlers(fs);
    this.registerTools(READ_TOOLS, readHandlers as unknown as Record<string, ToolHandler>, 'filesystem');

    // Créer des handlers d'écriture wrappés pour tracker les corrections
    const writeHandlers = createWriteToolHandlers(fs);
    const wrappedWriteHandlers = this.wrapWriteHandlersWithTracking(writeHandlers);
    this.registerTools(WRITE_TOOLS, wrappedWriteHandlers, 'filesystem');

    this.log('info', 'FileSystem initialized for FixerAgent with ToolRegistry');
  }

  /**
   * Wrapper les handlers d'écriture pour tracker les corrections
   */
  private wrapWriteHandlersWithTracking(
    handlers: ReturnType<typeof createWriteToolHandlers>,
  ): Record<string, ToolHandler> {
    const wrapped: Record<string, ToolHandler> = {};

    for (const [name, handler] of Object.entries(handlers)) {
      wrapped[name] = async (input: Record<string, unknown>): Promise<ToolExecutionResult> => {
        const result = await (handler as (input: unknown) => Promise<ToolExecutionResult>)(input);

        // Tracker les corrections si succès
        if (result.success) {
          this.trackFix(name, input);
        }

        return result;
      };
    }

    return wrapped;
  }

  /**
   * Obtenir les corrections appliquées lors de la dernière exécution
   */
  getAppliedFixes(): AppliedFix[] {
    return [...this.appliedFixes];
  }

  /**
   * Obtenir l'historique des corrections
   */
  getFixHistory(): typeof this.fixHistory {
    return [...this.fixHistory];
  }

  /**
   * Vider l'historique des corrections
   */
  clearFixHistory(): void {
    this.fixHistory = [];
  }

  // executeToolHandler est hérité de BaseAgent et utilise le ToolRegistry

  /**
   * Tracker une correction appliquée
   */
  private trackFix(toolName: string, input: Record<string, unknown>): void {
    const path = (input.path || input.oldPath) as string;

    let action: 'edit' | 'create' | 'delete';
    let description = '';

    switch (toolName) {
      case 'write_file':
        action = 'create';
        description = 'File created/replaced';
        break;
      case 'edit_file':
        action = 'edit';
        description = `Edited: replaced "${(input.search as string)?.substring(0, 50)}..."`;
        break;
      case 'delete_file':
        action = 'delete';
        description = 'File deleted';
        break;
      default:
        action = 'edit';
        description = `Applied ${toolName}`;
    }

    this.appliedFixes.push({
      file: path,
      action,
      description,
      after: input.content as string | undefined,
    });
  }

  /**
   * Enregistrer un résultat de correction dans l'historique
   */
  recordFixResult(file: string, errorType: FixableErrorType, success: boolean): void {
    this.fixHistory.push({
      timestamp: new Date(),
      file,
      errorType,
      success,
    });

    // Garder seulement les 100 dernières corrections
    if (this.fixHistory.length > 100) {
      this.fixHistory = this.fixHistory.slice(-100);
    }
  }

  /**
   * Obtenir la liste des outils disponibles
   */
  getAvailableTools(): ToolDefinition[] {
    return this.config.tools;
  }

  /**
   * Créer une erreur fixable à partir d'un message d'erreur
   */
  static parseError(errorMessage: string, type: FixableErrorType = 'compilation'): FixableError {
    // Tenter d'extraire le fichier et la ligne
    const fileLineMatch = errorMessage.match(/(?:at\s+)?([^:\s]+(?:\.ts|\.tsx|\.js|\.jsx)):(\d+)(?::(\d+))?/);

    return {
      type,
      message: errorMessage,
      file: fileLineMatch?.[1],
      line: fileLineMatch?.[2] ? parseInt(fileLineMatch[2], 10) : undefined,
      column: fileLineMatch?.[3] ? parseInt(fileLineMatch[3], 10) : undefined,
    };
  }

  /**
   * Créer une erreur fixable à partir d'une issue de review
   */
  static fromReviewIssue(issue: CodeIssue): FixableError {
    let type: FixableErrorType = 'quality';

    if (issue.type === 'security') {
      type = 'security';
    } else if (issue.type === 'style') {
      type = 'lint';
    }

    return {
      type,
      message: issue.message,
      file: issue.file,
      line: issue.line,
      column: issue.column,
      severity: issue.severity === 'info' ? 'low' : issue.severity,
    };
  }
}

/*
 * ============================================================================
 * FACTORY
 * ============================================================================
 */

/**
 * Créer une instance du Fixer Agent
 */
export function createFixerAgent(fs?: WritableFileSystem): FixerAgent {
  const agent = new FixerAgent();

  if (fs) {
    agent.setFileSystem(fs);
  }

  return agent;
}
