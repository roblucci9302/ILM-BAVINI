/**
 * Point d'entrée principal du système de sous-agents BAVINI
 * Exporte tous les composants nécessaires
 */

// ============================================================================
// TYPES
// ============================================================================

export * from './types';

// ============================================================================
// CORE
// ============================================================================

export { BaseAgent } from './core/base-agent';
export { AgentRegistry, agentRegistry } from './core/agent-registry';
export type { RegisteredAgent, RegistryStats } from './core/agent-registry';

// ============================================================================
// AGENTS
// ============================================================================

export { ExploreAgent, createExploreAgent } from './agents/explore-agent';
export { Orchestrator, createOrchestrator } from './agents/orchestrator';

// ============================================================================
// TOOLS
// ============================================================================

export {
  READ_TOOLS,
  ReadFileTool,
  GrepTool,
  GlobTool,
  ListDirectoryTool,
  createReadToolHandlers,
} from './tools/read-tools';
export type { FileSystem } from './tools/read-tools';

// ============================================================================
// PROMPTS
// ============================================================================

export { EXPLORE_SYSTEM_PROMPT } from './prompts/explore-prompt';
export { ORCHESTRATOR_SYSTEM_PROMPT, AGENT_CAPABILITIES } from './prompts/orchestrator-prompt';

// ============================================================================
// SYSTÈME D'AGENTS COMPLET
// ============================================================================

import { AgentRegistry } from './core/agent-registry';
import { createExploreAgent } from './agents/explore-agent';
import { createOrchestrator } from './agents/orchestrator';
import type { FileSystem } from './tools/read-tools';
import type { Task, TaskResult, AgentEventCallback } from './types';
import {
  handleAgentEvent,
  updateAgentStatus,
  addAgentLog,
  resetAgentStores,
} from '../stores/agents';

/**
 * Configuration du système d'agents
 */
export interface AgentSystemConfig {
  /** Clé API Anthropic */
  apiKey: string;

  /** Système de fichiers (WebContainer) */
  fileSystem: FileSystem;

  /** Callback pour les événements (optionnel) */
  onEvent?: AgentEventCallback;

  /** Activer les logs détaillés */
  verbose?: boolean;
}

/**
 * Système d'agents BAVINI
 * Classe principale pour gérer tous les agents
 */
export class AgentSystem {
  private registry: AgentRegistry;
  private apiKey: string;
  private fileSystem: FileSystem;
  private eventCallback?: AgentEventCallback;
  private initialized = false;

  constructor(config: AgentSystemConfig) {
    this.registry = AgentRegistry.getInstance();
    this.apiKey = config.apiKey;
    this.fileSystem = config.fileSystem;
    this.eventCallback = config.onEvent;

    // Réinitialiser les stores
    resetAgentStores();
  }

  /**
   * Initialiser le système d'agents
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Créer et enregistrer l'Explore Agent
    const exploreAgent = createExploreAgent(this.fileSystem);
    this.registry.register(exploreAgent);

    // Créer et enregistrer l'Orchestrator
    const orchestrator = createOrchestrator();
    orchestrator.setApiKey(this.apiKey);
    this.registry.register(orchestrator);

    // S'abonner aux événements
    this.registry.subscribe((event) => {
      // Mettre à jour les stores
      handleAgentEvent(event);

      // Appeler le callback externe si fourni
      if (this.eventCallback) {
        this.eventCallback(event);
      }
    });

    this.initialized = true;

    addAgentLog('orchestrator', {
      level: 'info',
      message: 'Agent system initialized',
    });
  }

  /**
   * Exécuter une tâche via l'orchestrateur
   */
  async executeTask(prompt: string, context?: Record<string, unknown>): Promise<TaskResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'user_request',
      prompt,
      context: context
        ? {
            additionalInfo: context,
          }
        : undefined,
      status: 'pending',
      createdAt: new Date(),
    };

    updateAgentStatus('orchestrator', 'thinking');

    try {
      const orchestrator = this.registry.get('orchestrator');

      if (!orchestrator) {
        throw new Error('Orchestrator not found');
      }

      const result = await orchestrator.run(task, this.apiKey);

      return result;
    } finally {
      updateAgentStatus('orchestrator', 'idle');
    }
  }

  /**
   * Exécuter directement avec un agent spécifique
   */
  async executeWithAgent(
    agentName: string,
    prompt: string,
    context?: Record<string, unknown>
  ): Promise<TaskResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const agent = this.registry.get(agentName as any);

    if (!agent) {
      return {
        success: false,
        output: `Agent '${agentName}' non trouvé`,
        errors: [
          {
            code: 'AGENT_NOT_FOUND',
            message: `Agent ${agentName} not found`,
            recoverable: false,
          },
        ],
      };
    }

    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: agentName,
      prompt,
      context: context
        ? {
            additionalInfo: context,
          }
        : undefined,
      status: 'pending',
      createdAt: new Date(),
    };

    return agent.run(task, this.apiKey);
  }

  /**
   * Obtenir le statut du système
   */
  getStatus(): {
    initialized: boolean;
    agents: Array<{
      name: string;
      status: string;
      description: string;
    }>;
  } {
    return {
      initialized: this.initialized,
      agents: this.registry.getAgentsInfo().map((a) => ({
        name: a.name,
        status: a.status,
        description: a.description,
      })),
    };
  }

  /**
   * Arrêter le système
   */
  async shutdown(): Promise<void> {
    // Annuler toutes les tâches en cours
    for (const agent of this.registry.getAll().values()) {
      if (!agent.isAvailable()) {
        agent.abort();
      }
    }

    // Réinitialiser les stores
    resetAgentStores();

    this.initialized = false;
  }
}

/**
 * Créer une instance du système d'agents
 */
export function createAgentSystem(config: AgentSystemConfig): AgentSystem {
  return new AgentSystem(config);
}
