/**
 * Registre des agents BAVINI
 * Singleton qui gère l'enregistrement et la récupération des agents
 */

import type { BaseAgent } from './base-agent';
import type { AgentType, AgentStatus, AgentEventCallback, AgentEvent } from '../types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('AgentRegistry');

/**
 * Information sur un agent enregistré
 */
export interface RegisteredAgent {
  agent: BaseAgent;
  registeredAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
}

/**
 * Statistiques du registre
 */
export interface RegistryStats {
  totalAgents: number;
  availableAgents: number;
  busyAgents: number;
  agentsByType: Record<AgentType, number>;
}

/**
 * Registre singleton des agents
 */
export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<AgentType, RegisteredAgent> = new Map();
  private eventCallbacks: Set<AgentEventCallback> = new Set();

  private constructor() {
    logger.info('AgentRegistry initialized');
  }

  /**
   * Obtenir l'instance singleton
   */
  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Réinitialiser le registre (utile pour les tests)
   */
  static resetInstance(): void {
    if (AgentRegistry.instance) {
      AgentRegistry.instance.clear();
    }
    AgentRegistry.instance = new AgentRegistry();
  }

  // ============================================================================
  // ENREGISTREMENT
  // ============================================================================

  /**
   * Enregistrer un agent
   */
  register(agent: BaseAgent): void {
    const name = agent.getName() as AgentType;

    if (this.agents.has(name)) {
      logger.warn(`Agent ${name} already registered, replacing`);
    }

    this.agents.set(name, {
      agent,
      registeredAt: new Date(),
      usageCount: 0,
    });

    // S'abonner aux événements de l'agent
    agent.subscribe((event) => this.handleAgentEvent(event));

    logger.info(`Agent registered: ${name}`, {
      description: agent.getDescription(),
    });

    this.emitEvent({
      type: 'agent:started',
      timestamp: new Date(),
      agentName: name,
      data: { action: 'registered' },
    });
  }

  /**
   * Supprimer un agent du registre
   */
  unregister(name: AgentType): boolean {
    const registered = this.agents.get(name);

    if (!registered) {
      logger.warn(`Agent ${name} not found for unregistration`);
      return false;
    }

    // Vérifier que l'agent n'est pas en cours d'exécution
    if (registered.agent.getStatus() !== 'idle') {
      logger.warn(`Cannot unregister busy agent: ${name}`);
      return false;
    }

    this.agents.delete(name);
    logger.info(`Agent unregistered: ${name}`);

    return true;
  }

  /**
   * Vider le registre
   */
  clear(): void {
    for (const [name, registered] of this.agents) {
      if (registered.agent.getStatus() !== 'idle') {
        registered.agent.abort();
      }
    }
    this.agents.clear();
    logger.info('Registry cleared');
  }

  // ============================================================================
  // RÉCUPÉRATION
  // ============================================================================

  /**
   * Obtenir un agent par son nom
   */
  get(name: AgentType): BaseAgent | undefined {
    const registered = this.agents.get(name);

    if (registered) {
      registered.lastUsedAt = new Date();
      registered.usageCount++;
      return registered.agent;
    }

    return undefined;
  }

  /**
   * Vérifier si un agent existe
   */
  has(name: AgentType): boolean {
    return this.agents.has(name);
  }

  /**
   * Obtenir tous les agents
   */
  getAll(): Map<AgentType, BaseAgent> {
    const result = new Map<AgentType, BaseAgent>();
    for (const [name, registered] of this.agents) {
      result.set(name, registered.agent);
    }
    return result;
  }

  /**
   * Obtenir les noms de tous les agents
   */
  getNames(): AgentType[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Obtenir les informations d'enregistrement d'un agent
   */
  getInfo(name: AgentType): RegisteredAgent | undefined {
    return this.agents.get(name);
  }

  // ============================================================================
  // FILTRAGE
  // ============================================================================

  /**
   * Obtenir les agents disponibles (idle)
   */
  getAvailable(): BaseAgent[] {
    const available: BaseAgent[] = [];

    for (const registered of this.agents.values()) {
      if (registered.agent.isAvailable()) {
        available.push(registered.agent);
      }
    }

    return available;
  }

  /**
   * Obtenir les agents par statut
   */
  getByStatus(status: AgentStatus): BaseAgent[] {
    const result: BaseAgent[] = [];

    for (const registered of this.agents.values()) {
      if (registered.agent.getStatus() === status) {
        result.push(registered.agent);
      }
    }

    return result;
  }

  /**
   * Trouver le meilleur agent pour une tâche
   * Basé sur la description et la disponibilité
   */
  findBestAgent(taskDescription: string, excludeOrchestrator = true): BaseAgent | null {
    const available = this.getAvailable();

    // Filtrer l'orchestrateur si demandé
    const candidates = excludeOrchestrator
      ? available.filter((a) => a.getName() !== 'orchestrator')
      : available;

    if (candidates.length === 0) {
      return null;
    }

    // Pour l'instant, retourner le premier disponible
    // TODO: Implémenter un scoring basé sur la description
    return candidates[0];
  }

  /**
   * Trouver un agent par capacité (présence d'un outil)
   */
  findByCapability(toolName: string): BaseAgent[] {
    const result: BaseAgent[] = [];

    for (const registered of this.agents.values()) {
      const config = registered.agent.getConfig();
      const hasTool = config.tools.some((t) => t.name === toolName);

      if (hasTool) {
        result.push(registered.agent);
      }
    }

    return result;
  }

  // ============================================================================
  // STATISTIQUES
  // ============================================================================

  /**
   * Obtenir les statistiques du registre
   */
  getStats(): RegistryStats {
    const stats: RegistryStats = {
      totalAgents: this.agents.size,
      availableAgents: 0,
      busyAgents: 0,
      agentsByType: {} as Record<AgentType, number>,
    };

    for (const [name, registered] of this.agents) {
      stats.agentsByType[name] = 1;

      if (registered.agent.isAvailable()) {
        stats.availableAgents++;
      } else {
        stats.busyAgents++;
      }
    }

    return stats;
  }

  /**
   * Obtenir les informations de tous les agents
   */
  getAgentsInfo(): Array<{
    name: AgentType;
    status: AgentStatus;
    description: string;
    usageCount: number;
    registeredAt: Date;
    lastUsedAt?: Date;
  }> {
    const info = [];

    for (const [name, registered] of this.agents) {
      info.push({
        name,
        status: registered.agent.getStatus(),
        description: registered.agent.getDescription(),
        usageCount: registered.usageCount,
        registeredAt: registered.registeredAt,
        lastUsedAt: registered.lastUsedAt,
      });
    }

    return info;
  }

  // ============================================================================
  // ÉVÉNEMENTS
  // ============================================================================

  /**
   * S'abonner aux événements du registre
   */
  subscribe(callback: AgentEventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  /**
   * Gérer un événement d'agent
   */
  private handleAgentEvent(event: AgentEvent): void {
    // Propager l'événement aux abonnés du registre
    this.emitEvent(event);
  }

  /**
   * Émettre un événement
   */
  private emitEvent(event: AgentEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (error) {
        logger.error('Event callback error', { error });
      }
    }
  }
}

// Export de l'instance par défaut
export const agentRegistry = AgentRegistry.getInstance();
