/**
 * Task Queue - Système de file d'attente et d'exécution parallèle des tâches
 * Gère les dépendances entre tâches et l'exécution concurrente
 */

import type { Task, TaskResult, TaskStatus, AgentType, AgentEvent } from '../types';
import { AgentRegistry } from './agent-registry';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('TaskQueue');

/*
 * ============================================================================
 * TYPES
 * ============================================================================
 */

/**
 * Configuration de la queue
 */
export interface TaskQueueConfig {
  /** Nombre maximum de tâches parallèles */
  maxParallel: number;

  /** Délai avant retry (ms) */
  retryDelay: number;

  /** Nombre maximum de retries */
  maxRetries: number;

  /** Callback pour les événements */
  onEvent?: (event: AgentEvent) => void;
}

/**
 * Élément de la queue
 */
interface QueueItem {
  task: Task;
  resolve: (result: TaskResult) => void;
  reject: (error: Error) => void;
  retryCount: number;
}

/**
 * Statistiques de la queue
 */
export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  totalProcessed: number;
}

/*
 * ============================================================================
 * TASK QUEUE
 * ============================================================================
 */

/**
 * File d'attente des tâches avec exécution parallèle
 */
export class TaskQueue {
  private config: TaskQueueConfig;
  private registry: AgentRegistry;
  private apiKey: string;

  private queue: QueueItem[] = [];
  private running: Map<string, QueueItem> = new Map();
  private completed: Map<string, TaskResult> = new Map();
  private failed: Map<string, { task: Task; error: string }> = new Map();

  private isProcessing = false;
  private isPaused = false;

  constructor(registry: AgentRegistry, apiKey: string, config?: Partial<TaskQueueConfig>) {
    this.registry = registry;
    this.apiKey = apiKey;
    this.config = {
      maxParallel: config?.maxParallel ?? 3,
      retryDelay: config?.retryDelay ?? 1000,
      maxRetries: config?.maxRetries ?? 2,
      onEvent: config?.onEvent,
    };
  }

  /*
   * ==========================================================================
   * PUBLIC API
   * ==========================================================================
   */

  /**
   * Ajouter une tâche à la queue
   */
  async enqueue(task: Task): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      const item: QueueItem = {
        task: { ...task, status: 'queued' },
        resolve,
        reject,
        retryCount: 0,
      };

      this.queue.push(item);
      this.emitEvent('task:created', task.id, { task });
      this.log('info', `Task enqueued: ${task.id}`, { taskType: task.type });

      // Démarrer le traitement si pas déjà en cours
      this.processQueue();
    });
  }

  /**
   * Ajouter plusieurs tâches avec gestion des dépendances
   */
  async enqueueBatch(tasks: Task[]): Promise<Map<string, TaskResult>> {
    const results = new Map<string, TaskResult>();

    // Trier les tâches par dépendances
    const sortedTasks = this.topologicalSort(tasks);

    // Regrouper les tâches par niveau de dépendance
    const levels = this.groupByDependencyLevel(sortedTasks);

    for (const level of levels) {
      // Exécuter les tâches d'un même niveau en parallèle
      const levelPromises = level.map(async (task) => {
        // Attendre que les dépendances soient terminées
        if (task.dependencies) {
          for (const depId of task.dependencies) {
            if (!this.completed.has(depId)) {
              // Attendre que la dépendance soit dans completed
              await this.waitForTask(depId);
            }
          }
        }

        const result = await this.enqueue(task);
        results.set(task.id, result);

        return result;
      });

      await Promise.all(levelPromises);
    }

    return results;
  }

  /**
   * Pause le traitement de la queue
   */
  pause(): void {
    this.isPaused = true;
    this.log('info', 'Queue paused');
  }

  /**
   * Reprend le traitement
   */
  resume(): void {
    this.isPaused = false;
    this.log('info', 'Queue resumed');
    this.processQueue();
  }

  /**
   * Annuler une tâche en attente
   */
  cancel(taskId: string): boolean {
    const index = this.queue.findIndex((item) => item.task.id === taskId);

    if (index !== -1) {
      const item = this.queue.splice(index, 1)[0];
      item.task.status = 'cancelled';
      item.reject(new Error('Task cancelled'));
      this.log('info', `Task cancelled: ${taskId}`);

      return true;
    }

    return false;
  }

  /**
   * Vider la queue
   */
  clear(): void {
    for (const item of this.queue) {
      item.task.status = 'cancelled';
      item.reject(new Error('Queue cleared'));
    }

    this.queue = [];
    this.log('info', 'Queue cleared');
  }

  /**
   * Obtenir les statistiques
   */
  getStats(): QueueStats {
    return {
      pending: this.queue.length,
      running: this.running.size,
      completed: this.completed.size,
      failed: this.failed.size,
      totalProcessed: this.completed.size + this.failed.size,
    };
  }

  /**
   * Obtenir le résultat d'une tâche terminée
   */
  getResult(taskId: string): TaskResult | undefined {
    return this.completed.get(taskId);
  }

  /**
   * Obtenir toutes les tâches en attente
   */
  getPendingTasks(): Task[] {
    return this.queue.map((item) => item.task);
  }

  /**
   * Obtenir les tâches en cours d'exécution
   */
  getRunningTasks(): Task[] {
    return Array.from(this.running.values()).map((item) => item.task);
  }

  /*
   * ==========================================================================
   * PROCESSING
   * ==========================================================================
   */

  /**
   * Traiter la queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && this.running.size < this.config.maxParallel && !this.isPaused) {
        const item = this.queue.shift();

        if (!item) {
          break;
        }

        // Vérifier les dépendances
        if (item.task.dependencies) {
          const unmetDeps = item.task.dependencies.filter((depId) => !this.completed.has(depId));

          if (unmetDeps.length > 0) {
            // Remettre dans la queue
            this.queue.push(item);
            continue;
          }
        }

        // Démarrer l'exécution
        this.running.set(item.task.id, item);
        this.executeTask(item);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Exécuter une tâche
   */
  private async executeTask(item: QueueItem): Promise<void> {
    const { task } = item;
    task.status = 'in_progress';
    task.startedAt = new Date();

    this.emitEvent('task:started', task.id, { task });
    this.log('info', `Task started: ${task.id}`, { agent: task.assignedAgent });

    try {
      // Trouver l'agent approprié
      const agent = this.findAgentForTask(task);

      if (!agent) {
        throw new Error(`No agent available for task type: ${task.type}`);
      }

      // Exécuter la tâche
      const result = await agent.run(task, this.apiKey);

      // Succès
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;

      this.completed.set(task.id, result);
      this.running.delete(task.id);

      this.emitEvent('task:completed', task.id, { task, result });
      this.log('info', `Task completed: ${task.id}`, { success: result.success });

      item.resolve(result);
    } catch (error) {
      // Gestion des erreurs avec retry
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (item.retryCount < this.config.maxRetries) {
        // Retry
        item.retryCount++;
        this.running.delete(task.id);
        this.log('warn', `Task retry ${item.retryCount}/${this.config.maxRetries}: ${task.id}`, {
          error: errorMessage,
        });

        // Attendre avant de réessayer
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
        this.queue.unshift(item);
      } else {
        // Échec définitif
        task.status = 'failed';
        task.completedAt = new Date();

        const result: TaskResult = {
          success: false,
          output: errorMessage,
          errors: [
            {
              code: 'TASK_EXECUTION_FAILED',
              message: errorMessage,
              recoverable: false,
            },
          ],
        };

        task.result = result;

        this.failed.set(task.id, { task, error: errorMessage });
        this.running.delete(task.id);

        this.emitEvent('task:failed', task.id, { task, error: errorMessage });
        this.log('error', `Task failed: ${task.id}`, { error: errorMessage });

        item.resolve(result);
      }
    }

    // Continuer le traitement
    this.processQueue();
  }

  /**
   * Trouver l'agent approprié pour une tâche
   */
  private findAgentForTask(task: Task): ReturnType<AgentRegistry['get']> | undefined {
    // Si un agent est assigné, l'utiliser
    if (task.assignedAgent) {
      return this.registry.get(task.assignedAgent);
    }

    // Sinon, chercher par type de tâche
    const agentType = task.type as AgentType;
    const agent = this.registry.get(agentType);

    if (agent && agent.isAvailable()) {
      return agent;
    }

    // Chercher un agent disponible par capacité
    const available = this.registry.getAvailable();

    for (const a of available) {
      if (a.getName() === task.type || task.type === 'user_request') {
        return a;
      }
    }

    return undefined;
  }

  /*
   * ==========================================================================
   * HELPERS
   * ==========================================================================
   */

  /**
   * Attendre qu'une tâche soit terminée
   */
  private async waitForTask(taskId: string, timeout = 300000): Promise<TaskResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.completed.has(taskId)) {
        return this.completed.get(taskId)!;
      }

      if (this.failed.has(taskId)) {
        throw new Error(`Dependency task failed: ${taskId}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for task: ${taskId}`);
  }

  /**
   * Tri topologique des tâches par dépendances
   */
  private topologicalSort(tasks: Task[]): Task[] {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const visited = new Set<string>();
    const result: Task[] = [];

    const visit = (task: Task) => {
      if (visited.has(task.id)) {
        return;
      }

      visited.add(task.id);

      if (task.dependencies) {
        for (const depId of task.dependencies) {
          const dep = taskMap.get(depId);

          if (dep) {
            visit(dep);
          }
        }
      }

      result.push(task);
    };

    for (const task of tasks) {
      visit(task);
    }

    return result;
  }

  /**
   * Grouper les tâches par niveau de dépendance
   */
  private groupByDependencyLevel(sortedTasks: Task[]): Task[][] {
    const levels: Task[][] = [];
    const taskLevels = new Map<string, number>();

    for (const task of sortedTasks) {
      let level = 0;

      if (task.dependencies) {
        for (const depId of task.dependencies) {
          const depLevel = taskLevels.get(depId) ?? -1;
          level = Math.max(level, depLevel + 1);
        }
      }

      taskLevels.set(task.id, level);

      if (!levels[level]) {
        levels[level] = [];
      }

      levels[level].push(task);
    }

    return levels;
  }

  /**
   * Émettre un événement
   */
  private emitEvent(type: AgentEvent['type'], taskId: string, data: Record<string, unknown>): void {
    if (this.config.onEvent) {
      this.config.onEvent({
        type,
        timestamp: new Date(),
        taskId,
        data,
      });
    }
  }

  /**
   * Logger
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
    switch (level) {
      case 'info':
        logger.info(message, data);
        break;
      case 'warn':
        logger.warn(message, data);
        break;
      case 'error':
        logger.error(message, data);
        break;
    }
  }
}

/*
 * ============================================================================
 * FACTORY
 * ============================================================================
 */

/**
 * Créer une instance de TaskQueue
 */
export function createTaskQueue(registry: AgentRegistry, apiKey: string, config?: Partial<TaskQueueConfig>): TaskQueue {
  return new TaskQueue(registry, apiKey, config);
}
