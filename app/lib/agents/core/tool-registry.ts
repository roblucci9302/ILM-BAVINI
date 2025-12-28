/**
 * Tool Registry - Registre centralisé des handlers d'outils
 * Permet aux agents d'enregistrer et d'exécuter des outils de manière unifiée
 */

import type { ToolDefinition, ToolExecutionResult } from '../types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ToolRegistry');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Type d'un handler d'outil
 */
export type ToolHandler = (
  input: Record<string, unknown>
) => Promise<ToolExecutionResult>;

/**
 * Configuration d'un outil enregistré
 */
export interface RegisteredTool {
  /** Définition de l'outil (pour le LLM) */
  definition: ToolDefinition;
  /** Handler d'exécution */
  handler: ToolHandler;
  /** Catégorie de l'outil (filesystem, shell, git, etc.) */
  category?: string;
  /** Priorité (pour résolution de conflits) */
  priority?: number;
  /** Timestamp d'enregistrement */
  registeredAt: Date;
}

/**
 * Options d'enregistrement
 */
export interface RegisterOptions {
  category?: string;
  priority?: number;
  /** Remplacer si existe déjà */
  override?: boolean;
}

/**
 * Statistiques du registre
 */
export interface RegistryStats {
  totalTools: number;
  byCategory: Record<string, number>;
  executionCount: number;
  successCount: number;
  failureCount: number;
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

/**
 * Registre centralisé des outils pour les agents
 */
export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private stats = {
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
  };

  // ============================================================================
  // ENREGISTREMENT
  // ============================================================================

  /**
   * Enregistrer un outil avec son handler
   */
  register(
    definition: ToolDefinition,
    handler: ToolHandler,
    options: RegisterOptions = {}
  ): void {
    const { category, priority = 0, override = false } = options;

    if (this.tools.has(definition.name) && !override) {
      throw new Error(
        `Tool '${definition.name}' is already registered. Use override: true to replace it.`
      );
    }

    this.tools.set(definition.name, {
      definition,
      handler,
      category,
      priority,
      registeredAt: new Date(),
    });

    logger.debug(`Registered tool: ${definition.name}`, { category, priority });
  }

  /**
   * Enregistrer plusieurs outils d'un coup
   * @param definitions Liste des définitions d'outils
   * @param handlers Map nom -> handler
   * @param category Catégorie commune
   */
  registerBatch(
    definitions: ToolDefinition[],
    handlers: Record<string, ToolHandler>,
    category?: string
  ): void {
    let registered = 0;
    let skipped = 0;

    for (const def of definitions) {
      const handler = handlers[def.name];

      if (handler) {
        try {
          this.register(def, handler, { category });
          registered++;
        } catch (error) {
          logger.warn(`Failed to register tool ${def.name}:`, error);
          skipped++;
        }
      } else {
        logger.warn(`No handler found for tool: ${def.name}`);
        skipped++;
      }
    }

    logger.debug(`Batch registered ${registered} tools, skipped ${skipped}`, { category });
  }

  /**
   * Désinscrire un outil
   */
  unregister(name: string): boolean {
    const existed = this.tools.delete(name);

    if (existed) {
      logger.debug(`Unregistered tool: ${name}`);
    }

    return existed;
  }

  /**
   * Désinscrire tous les outils d'une catégorie
   */
  unregisterCategory(category: string): number {
    let count = 0;

    for (const [name, tool] of this.tools) {
      if (tool.category === category) {
        this.tools.delete(name);
        count++;
      }
    }

    logger.debug(`Unregistered ${count} tools from category: ${category}`);
    return count;
  }

  // ============================================================================
  // REQUÊTES
  // ============================================================================

  /**
   * Vérifier si un outil existe
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Obtenir un outil enregistré
   */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Obtenir le handler d'un outil
   */
  getHandler(name: string): ToolHandler | undefined {
    return this.tools.get(name)?.handler;
  }

  /**
   * Obtenir la définition d'un outil
   */
  getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  /**
   * Obtenir toutes les définitions d'outils (pour le LLM)
   */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values())
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .map((t) => t.definition);
  }

  /**
   * Obtenir les noms de tous les outils
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Obtenir les outils par catégorie
   */
  getByCategory(category: string): RegisteredTool[] {
    return Array.from(this.tools.values()).filter((t) => t.category === category);
  }

  /**
   * Obtenir toutes les catégories
   */
  getCategories(): string[] {
    const categories = new Set<string>();

    for (const tool of this.tools.values()) {
      if (tool.category) {
        categories.add(tool.category);
      }
    }

    return Array.from(categories);
  }

  // ============================================================================
  // EXÉCUTION
  // ============================================================================

  /**
   * Exécuter un outil
   */
  async execute(
    name: string,
    input: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    this.stats.executionCount++;

    const tool = this.tools.get(name);

    if (!tool) {
      this.stats.failureCount++;
      logger.warn(`Tool not found: ${name}`);

      return {
        success: false,
        output: null,
        error: `Tool '${name}' not found in registry. Available tools: ${this.getToolNames().join(', ')}`,
      };
    }

    const startTime = Date.now();

    try {
      logger.debug(`Executing tool: ${name}`, { input });

      const result = await tool.handler(input);
      const executionTime = Date.now() - startTime;

      if (result.success) {
        this.stats.successCount++;
      } else {
        this.stats.failureCount++;
      }

      logger.debug(`Tool ${name} completed`, {
        success: result.success,
        executionTime,
      });

      return {
        ...result,
        executionTime,
      };
    } catch (error) {
      this.stats.failureCount++;
      const executionTime = Date.now() - startTime;

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Tool ${name} failed:`, error);

      return {
        success: false,
        output: null,
        error: `Tool execution failed: ${errorMessage}`,
        executionTime,
      };
    }
  }

  /**
   * Exécuter plusieurs outils en parallèle
   */
  async executeParallel(
    calls: Array<{ name: string; input: Record<string, unknown> }>
  ): Promise<ToolExecutionResult[]> {
    return Promise.all(calls.map((call) => this.execute(call.name, call.input)));
  }

  /**
   * Exécuter plusieurs outils en séquence
   */
  async executeSequential(
    calls: Array<{ name: string; input: Record<string, unknown> }>,
    stopOnError: boolean = true
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const call of calls) {
      const result = await this.execute(call.name, call.input);
      results.push(result);

      if (!result.success && stopOnError) {
        break;
      }
    }

    return results;
  }

  // ============================================================================
  // UTILITAIRES
  // ============================================================================

  /**
   * Nombre d'outils enregistrés
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Vider le registre
   */
  clear(): void {
    this.tools.clear();
    this.stats = {
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
    };
    logger.debug('Registry cleared');
  }

  /**
   * Obtenir les statistiques
   */
  getStats(): RegistryStats {
    const byCategory: Record<string, number> = {};

    for (const tool of this.tools.values()) {
      const cat = tool.category || 'uncategorized';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    return {
      totalTools: this.tools.size,
      byCategory,
      ...this.stats,
    };
  }

  /**
   * Cloner le registre (shallow copy)
   */
  clone(): ToolRegistry {
    const newRegistry = new ToolRegistry();

    for (const [name, tool] of this.tools) {
      newRegistry.tools.set(name, { ...tool });
    }

    return newRegistry;
  }

  /**
   * Fusionner un autre registre (les outils existants ne sont pas remplacés)
   */
  merge(other: ToolRegistry): void {
    for (const [name, tool] of other.tools) {
      if (!this.tools.has(name)) {
        this.tools.set(name, { ...tool });
      }
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Créer un registre avec les outils de lecture (filesystem)
 */
export async function createReadToolsRegistry(
  fileSystem: import('../tools/read-tools').FileSystem
): Promise<ToolRegistry> {
  const { READ_TOOLS, createReadToolHandlers } = await import('../tools/read-tools');

  const registry = new ToolRegistry();
  const handlers = createReadToolHandlers(fileSystem);

  registry.registerBatch(READ_TOOLS, handlers as unknown as Record<string, ToolHandler>, 'filesystem');

  return registry;
}

/**
 * Créer un registre avec les outils d'écriture (filesystem)
 */
export async function createWriteToolsRegistry(
  fileSystem: import('../tools/write-tools').WritableFileSystem
): Promise<ToolRegistry> {
  const { WRITE_TOOLS, createWriteToolHandlers } = await import('../tools/write-tools');

  const registry = new ToolRegistry();
  const handlers = createWriteToolHandlers(fileSystem);

  registry.registerBatch(WRITE_TOOLS, handlers, 'filesystem');

  return registry;
}

/**
 * Créer un registre avec les outils shell
 */
export async function createShellToolsRegistry(
  shell: import('../tools/shell-tools').ShellInterface
): Promise<ToolRegistry> {
  const { SHELL_TOOLS, createShellToolHandlers } = await import('../tools/shell-tools');

  const registry = new ToolRegistry();
  const handlers = createShellToolHandlers(shell);

  registry.registerBatch(SHELL_TOOLS, handlers, 'shell');

  return registry;
}

/**
 * Créer un registre avec les outils Git
 */
export async function createGitToolsRegistry(
  git: import('../tools/git-tools').GitInterface
): Promise<ToolRegistry> {
  const { GIT_TOOLS, createGitToolHandlers } = await import('../tools/git-tools');

  const registry = new ToolRegistry();
  const handlers = createGitToolHandlers(git);

  registry.registerBatch(GIT_TOOLS, handlers, 'git');

  return registry;
}

/**
 * Créer un registre complet avec tous les outils standards
 */
export async function createStandardToolRegistry(adapters: {
  fileSystem?: import('../tools/write-tools').WritableFileSystem;
  shell?: import('../tools/shell-tools').ShellInterface;
  git?: import('../tools/git-tools').GitInterface;
}): Promise<ToolRegistry> {
  const registry = new ToolRegistry();

  // Outils de lecture et écriture
  if (adapters.fileSystem) {
    const { READ_TOOLS, createReadToolHandlers } = await import('../tools/read-tools');
    const { WRITE_TOOLS, createWriteToolHandlers } = await import('../tools/write-tools');

    const readHandlers = createReadToolHandlers(adapters.fileSystem);
    const writeHandlers = createWriteToolHandlers(adapters.fileSystem);

    registry.registerBatch(READ_TOOLS, readHandlers as unknown as Record<string, ToolHandler>, 'filesystem');
    registry.registerBatch(WRITE_TOOLS, writeHandlers, 'filesystem');
  }

  // Outils shell
  if (adapters.shell) {
    const { SHELL_TOOLS, createShellToolHandlers } = await import('../tools/shell-tools');
    const handlers = createShellToolHandlers(adapters.shell);

    registry.registerBatch(SHELL_TOOLS, handlers, 'shell');
  }

  // Outils Git
  if (adapters.git) {
    const { GIT_TOOLS, createGitToolHandlers } = await import('../tools/git-tools');
    const handlers = createGitToolHandlers(adapters.git);

    registry.registerBatch(GIT_TOOLS, handlers, 'git');
  }

  logger.info(`Standard tool registry created with ${registry.size} tools`);

  return registry;
}
