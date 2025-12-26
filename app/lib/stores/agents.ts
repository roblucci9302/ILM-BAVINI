/**
 * Store Nanostores pour la gestion de l'état des agents BAVINI
 * Gère le statut, les logs, et les tâches des agents
 */

import { atom, map, computed } from 'nanostores';
import type {
  AgentType,
  AgentStatus,
  Task,
  TaskStatus,
  LogEntry,
  AgentEvent,
  TaskResult,
} from '../agents/types';

// ============================================================================
// STORES D'ÉTAT DES AGENTS
// ============================================================================

/**
 * Statut de chaque agent
 */
export const agentStatusStore = map<Record<AgentType, AgentStatus>>({
  orchestrator: 'idle',
  explore: 'idle',
  coder: 'idle',
  builder: 'idle',
  tester: 'idle',
  deployer: 'idle',
  reviewer: 'idle',
  fixer: 'idle',
});

/**
 * Agents actuellement actifs (en cours d'exécution)
 */
export const activeAgentsStore = atom<AgentType[]>([]);

/**
 * Tâche en cours pour chaque agent
 */
export const currentTasksStore = map<Record<AgentType, Task | null>>({
  orchestrator: null,
  explore: null,
  coder: null,
  builder: null,
  tester: null,
  deployer: null,
  reviewer: null,
  fixer: null,
});

// ============================================================================
// STORES DE LOGS
// ============================================================================

/**
 * Logs de chaque agent (derniers 100 par agent)
 */
export const agentLogsStore = map<Record<AgentType, LogEntry[]>>({
  orchestrator: [],
  explore: [],
  coder: [],
  builder: [],
  tester: [],
  deployer: [],
  reviewer: [],
  fixer: [],
});

/**
 * Logs globaux du système (derniers 500)
 */
export const systemLogsStore = atom<LogEntry[]>([]);

// ============================================================================
// STORES DE TÂCHES
// ============================================================================

/**
 * Queue des tâches en attente
 */
export const taskQueueStore = atom<Task[]>([]);

/**
 * Historique des tâches complétées
 */
export const completedTasksStore = atom<Array<Task & { result: TaskResult }>>([]);

/**
 * Tâche actuellement en cours d'exécution par l'orchestrateur
 */
export const currentOrchestratorTaskStore = atom<Task | null>(null);

// ============================================================================
// STORES CALCULÉS
// ============================================================================

/**
 * Nombre d'agents actifs
 */
export const activeAgentCountStore = computed(activeAgentsStore, (agents) => agents.length);

/**
 * Agents disponibles (idle)
 */
export const availableAgentsStore = computed(agentStatusStore, (statuses) => {
  return (Object.keys(statuses) as AgentType[]).filter(
    (agent) => statuses[agent] === 'idle'
  );
});

/**
 * Statistiques globales
 */
export const agentStatsStore = computed(
  [agentStatusStore, completedTasksStore, taskQueueStore],
  (statuses, completed, queue) => {
    const agents = Object.keys(statuses) as AgentType[];

    return {
      totalAgents: agents.length,
      idleAgents: agents.filter((a) => statuses[a] === 'idle').length,
      busyAgents: agents.filter((a) => statuses[a] !== 'idle').length,
      completedTasks: completed.length,
      pendingTasks: queue.length,
      successfulTasks: completed.filter((t) => t.result.success).length,
      failedTasks: completed.filter((t) => !t.result.success).length,
    };
  }
);

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Mettre à jour le statut d'un agent
 */
export function updateAgentStatus(agent: AgentType, status: AgentStatus): void {
  agentStatusStore.setKey(agent, status);

  // Mettre à jour la liste des agents actifs
  const active = activeAgentsStore.get();

  if (status === 'idle' || status === 'completed' || status === 'failed') {
    activeAgentsStore.set(active.filter((a) => a !== agent));
  } else if (!active.includes(agent)) {
    activeAgentsStore.set([...active, agent]);
  }
}

/**
 * Définir la tâche en cours d'un agent
 */
export function setCurrentTask(agent: AgentType, task: Task | null): void {
  currentTasksStore.setKey(agent, task);
}

/**
 * Ajouter un log pour un agent
 */
export function addAgentLog(agent: AgentType, log: Omit<LogEntry, 'timestamp'>): void {
  const entry: LogEntry = {
    ...log,
    timestamp: new Date(),
    agentName: agent,
  };

  // Ajouter au log de l'agent
  const currentLogs = agentLogsStore.get()[agent] || [];
  const newLogs = [...currentLogs.slice(-99), entry]; // Garder les 100 derniers
  agentLogsStore.setKey(agent, newLogs);

  // Ajouter au log système
  const systemLogs = systemLogsStore.get();
  systemLogsStore.set([...systemLogs.slice(-499), entry]); // Garder les 500 derniers
}

/**
 * Ajouter une tâche à la queue
 */
export function enqueueTask(task: Task): void {
  const queue = taskQueueStore.get();
  taskQueueStore.set([...queue, task]);
}

/**
 * Retirer une tâche de la queue
 */
export function dequeueTask(): Task | undefined {
  const queue = taskQueueStore.get();
  if (queue.length === 0) return undefined;

  const [task, ...rest] = queue;
  taskQueueStore.set(rest);
  return task;
}

/**
 * Marquer une tâche comme complétée
 */
export function completeTask(task: Task, result: TaskResult): void {
  const completed = completedTasksStore.get();
  completedTasksStore.set([
    ...completed.slice(-99), // Garder les 100 dernières
    { ...task, status: 'completed' as TaskStatus, result },
  ]);
}

/**
 * Traiter un événement d'agent
 */
export function handleAgentEvent(event: AgentEvent): void {
  const agent = event.agentName;
  if (!agent) return;

  switch (event.type) {
    case 'agent:started':
      updateAgentStatus(agent, 'executing');
      break;

    case 'agent:completed':
      updateAgentStatus(agent, 'completed');
      // Reset to idle after a short delay
      setTimeout(() => updateAgentStatus(agent, 'idle'), 1000);
      break;

    case 'agent:failed':
      updateAgentStatus(agent, 'failed');
      addAgentLog(agent, {
        level: 'error',
        message: `Agent failed: ${JSON.stringify(event.data)}`,
      });
      // Reset to idle after a short delay
      setTimeout(() => updateAgentStatus(agent, 'idle'), 2000);
      break;

    case 'agent:tool_call':
      updateAgentStatus(agent, 'waiting_for_tool');
      addAgentLog(agent, {
        level: 'debug',
        message: `Tool call: ${event.data.toolName}`,
        data: event.data,
      });
      break;

    case 'agent:tool_result':
      updateAgentStatus(agent, 'executing');
      break;

    case 'task:created':
      addAgentLog(agent, {
        level: 'info',
        message: `Task created: ${event.data.taskId}`,
        data: event.data,
      });
      break;

    case 'task:started':
      updateAgentStatus(agent, 'executing');
      addAgentLog(agent, {
        level: 'info',
        message: `Task started: ${event.data.taskId}`,
      });
      break;

    case 'task:completed':
      addAgentLog(agent, {
        level: 'info',
        message: `Task completed: ${event.data.taskId}`,
        data: event.data,
      });
      break;

    case 'task:failed':
      addAgentLog(agent, {
        level: 'error',
        message: `Task failed: ${event.data.taskId}`,
        data: event.data,
      });
      break;

    case 'orchestrator:decision':
      addAgentLog(agent, {
        level: 'info',
        message: `Decision: ${event.data.action}`,
        data: event.data,
      });
      break;

    case 'orchestrator:delegated':
      addAgentLog(agent, {
        level: 'info',
        message: `Delegated to: ${event.data.targetAgent}`,
        data: event.data,
      });
      break;
  }
}

/**
 * Réinitialiser tous les stores
 */
export function resetAgentStores(): void {
  agentStatusStore.set({
    orchestrator: 'idle',
    explore: 'idle',
    coder: 'idle',
    builder: 'idle',
    tester: 'idle',
    deployer: 'idle',
    reviewer: 'idle',
    fixer: 'idle',
  });

  activeAgentsStore.set([]);

  currentTasksStore.set({
    orchestrator: null,
    explore: null,
    coder: null,
    builder: null,
    tester: null,
    deployer: null,
    reviewer: null,
    fixer: null,
  });

  agentLogsStore.set({
    orchestrator: [],
    explore: [],
    coder: [],
    builder: [],
    tester: [],
    deployer: [],
    reviewer: [],
    fixer: [],
  });

  systemLogsStore.set([]);
  taskQueueStore.set([]);
  completedTasksStore.set([]);
  currentOrchestratorTaskStore.set(null);
}

/**
 * Obtenir un résumé de l'état du système
 */
export function getSystemSummary(): {
  agents: Record<AgentType, { status: AgentStatus; currentTask: string | null }>;
  stats: ReturnType<typeof agentStatsStore.get>;
  recentLogs: LogEntry[];
} {
  const statuses = agentStatusStore.get();
  const tasks = currentTasksStore.get();
  const agents = Object.keys(statuses) as AgentType[];

  return {
    agents: agents.reduce(
      (acc, agent) => {
        acc[agent] = {
          status: statuses[agent],
          currentTask: tasks[agent]?.prompt.substring(0, 50) || null,
        };
        return acc;
      },
      {} as Record<AgentType, { status: AgentStatus; currentTask: string | null }>
    ),
    stats: agentStatsStore.get(),
    recentLogs: systemLogsStore.get().slice(-10),
  };
}
