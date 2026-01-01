/**
 * @fileoverview Registre centralisé des agents BAVINI
 *
 * Ce module fournit un singleton pour gérer l'enregistrement, la récupération
 * et le suivi des agents du système multi-agent. Il permet:
 * - Enregistrement/désenregistrement dynamique d'agents
 * - Récupération d'agents par nom ou capacité
 * - Suivi des statistiques d'utilisation
 * - Propagation des événements des agents
 *
 * @module agents/core/agent-registry
 * @see {@link BaseAgent} pour la classe de base des agents
 *
 * @example
 * ```typescript
 * // Obtenir l'instance du registre
 * const registry = AgentRegistry.getInstance();
 *
 * // Enregistrer un agent
 * registry.register(new CoderAgent());
 *
 * // Récupérer et utiliser un agent
 * const coder = registry.get('coder');
 * if (coder?.isAvailable()) {
 *   await coder.run(task, apiKey);
 * }
 * ```
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
 * Registre singleton des agents BAVINI
 *
 * Cette classe implémente le pattern Singleton pour centraliser la gestion
 * de tous les agents du système. Elle offre:
 * - Enregistrement et désenregistrement d'agents
 * - Recherche par nom, statut ou capacité
 * - Statistiques d'utilisation
 * - Système d'événements pour le monitoring
 *
 * @class AgentRegistry
 * @example
 * ```typescript
 * // Pattern Singleton - obtenir l'instance
 * const registry = AgentRegistry.getInstance();
 *
 * // Enregistrer tous les agents
 * registry.register(new ExplorerAgent());
 * registry.register(new CoderAgent());
 *
 * // Trouver les agents disponibles
 * const available = registry.getAvailable();
 * console.log(`${available.length} agents prêts`);
 *
 * // Écouter les événements
 * registry.subscribe((event) => {
 *   console.log(`Agent ${event.agentName}: ${event.type}`);
 * });
 * ```
 */
export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<AgentType, RegisteredAgent> = new Map();
  private eventCallbacks: Set<AgentEventCallback> = new Set();

  private constructor() {
    logger.info('AgentRegistry initialized');
  }

  /**
   * Obtenir l'instance singleton du registre
   *
   * @static
   * @returns {AgentRegistry} L'instance unique du registre
   *
   * @example
   * ```typescript
   * const registry = AgentRegistry.getInstance();
   * ```
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

  /*
   * ============================================================================
   * ENREGISTREMENT
   * ============================================================================
   */

  /**
   * Enregistrer un agent dans le registre
   *
   * L'agent sera disponible pour la récupération et le registre
   * s'abonnera automatiquement à ses événements.
   *
   * @param {BaseAgent} agent - L'agent à enregistrer
   * @returns {void}
   * @emits agent:started - Avec action='registered' lors de l'enregistrement
   *
   * @example
   * ```typescript
   * const coder = new CoderAgent();
   * registry.register(coder);
   * // L'agent est maintenant disponible via registry.get('coder')
   * ```
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

  /*
   * ============================================================================
   * RÉCUPÉRATION
   * ============================================================================
   */

  /**
   * Obtenir un agent par son nom
   *
   * Incrémente automatiquement le compteur d'utilisation
   * et met à jour lastUsedAt.
   *
   * @param {AgentType} name - Le nom de l'agent (ex: 'coder', 'explorer')
   * @returns {BaseAgent | undefined} L'agent ou undefined si non trouvé
   *
   * @example
   * ```typescript
   * const explorer = registry.get('explorer');
   * if (explorer && explorer.isAvailable()) {
   *   const result = await explorer.run(task, apiKey);
   * }
   * ```
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

  /*
   * ============================================================================
   * FILTRAGE
   * ============================================================================
   */

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
   * Trouver le meilleur agent pour une tâche donnée
   *
   * Sélectionne un agent disponible basé sur la description de la tâche
   * et ses capacités. Par défaut, exclut l'orchestrateur.
   *
   * @param {string} taskDescription - Description de la tâche à accomplir
   * @param {boolean} [excludeOrchestrator=true] - Exclure l'orchestrateur de la recherche
   * @returns {BaseAgent | null} L'agent le plus adapté ou null si aucun disponible
   *
   * @example
   * ```typescript
   * const agent = registry.findBestAgent('Génère du code TypeScript');
   * if (agent) {
   *   console.log(`Agent sélectionné: ${agent.getName()}`);
   * }
   * ```
   */
  findBestAgent(taskDescription: string, excludeOrchestrator = true): BaseAgent | null {
    const available = this.getAvailable();

    // Filtrer l'orchestrateur si demandé
    const candidates = excludeOrchestrator ? available.filter((a) => a.getName() !== 'orchestrator') : available;

    if (candidates.length === 0) {
      return null;
    }

    /*
     * Pour l'instant, retourner le premier disponible
     * TODO: Implémenter un scoring basé sur la description
     */
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

  /*
   * ============================================================================
   * STATISTIQUES
   * ============================================================================
   */

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

  /*
   * ============================================================================
   * ÉVÉNEMENTS
   * ============================================================================
   */

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
