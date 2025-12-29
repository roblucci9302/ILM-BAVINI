/**
 * Types et interfaces pour le système de sous-agents BAVINI
 * Tous les agents utilisent Claude Sonnet
 */

// ============================================================================
// TYPES DE BASE
// ============================================================================

/**
 * Modèle utilisé par les agents (Sonnet uniquement pour l'instant)
 */
export type AgentModel = 'claude-sonnet-4-5-20250929';

/**
 * Statut d'un agent
 */
export type AgentStatus =
  | 'idle' // En attente
  | 'thinking' // Analyse de la tâche
  | 'executing' // Exécution en cours
  | 'waiting_for_tool' // Attente résultat d'outil
  | 'completed' // Terminé avec succès
  | 'failed' // Échec
  | 'aborted'; // Annulé

/**
 * Statut d'une tâche
 */
export type TaskStatus =
  | 'pending' // En attente
  | 'queued' // Dans la queue
  | 'in_progress' // En cours
  | 'completed' // Terminée
  | 'failed' // Échouée
  | 'cancelled'; // Annulée

/**
 * Type d'agent disponible
 */
export type AgentType =
  | 'orchestrator'
  | 'explore'
  | 'coder'
  | 'builder'
  | 'tester'
  | 'deployer'
  | 'reviewer'
  | 'fixer';

/**
 * Type d'outil disponible
 */
export type ToolType =
  | 'read_file'
  | 'grep'
  | 'glob'
  | 'list_directory'
  | 'write_file'
  | 'edit_file'
  | 'create_file'
  | 'delete_file'
  | 'shell_command'
  | 'npm_command'
  | 'git_command'
  | 'run_tests';

// ============================================================================
// CONFIGURATION DES AGENTS
// ============================================================================

/**
 * Configuration d'un agent
 */
export interface AgentConfig {
  /** Identifiant unique de l'agent */
  name: AgentType;

  /** Description pour l'orchestrateur (aide à choisir le bon agent) */
  description: string;

  /** Modèle Claude à utiliser */
  model: AgentModel;

  /** Outils disponibles pour cet agent */
  tools: ToolDefinition[];

  /** System prompt de l'agent */
  systemPrompt: string;

  /** Nombre maximum de tokens en sortie */
  maxTokens?: number;

  /** Température (0 = déterministe, 1 = créatif) */
  temperature?: number;

  /** Timeout en millisecondes */
  timeout?: number;

  /** Nombre max de retries */
  maxRetries?: number;
}

// ============================================================================
// DÉFINITION DES OUTILS
// ============================================================================

/**
 * Définition d'un outil utilisable par un agent
 */
export interface ToolDefinition {
  /** Nom de l'outil */
  name: ToolType | string;

  /** Description pour le modèle */
  description: string;

  /** Schéma JSON des paramètres d'entrée */
  inputSchema: ToolInputSchema;
}

/**
 * Schéma des paramètres d'un outil
 */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, ToolPropertySchema>;
  required?: string[];
}

/**
 * Schéma d'une propriété d'outil
 */
export interface ToolPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: ToolPropertySchema;
  properties?: Record<string, ToolPropertySchema>;
  required?: string[];
  default?: unknown;
}

/**
 * Résultat d'exécution d'un outil
 */
export interface ToolExecutionResult {
  success: boolean;
  output: unknown;
  error?: string;
  executionTime?: number;
}

// ============================================================================
// TÂCHES
// ============================================================================

/**
 * Tâche à exécuter par un agent
 */
export interface Task {
  /** Identifiant unique */
  id: string;

  /** Type de tâche (correspond souvent à un type d'agent) */
  type: string;

  /** Prompt/instruction pour l'agent */
  prompt: string;

  /** Contexte additionnel */
  context?: TaskContext;

  /** IDs des tâches dont celle-ci dépend */
  dependencies?: string[];

  /** Priorité (plus élevé = plus prioritaire) */
  priority?: number;

  /** Timeout en millisecondes */
  timeout?: number;

  /** Agent assigné */
  assignedAgent?: AgentType;

  /** Statut actuel */
  status: TaskStatus;

  /** Résultat de la tâche */
  result?: TaskResult;

  /** Métadonnées */
  metadata?: TaskMetadata;

  /** Timestamps */
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Contexte d'une tâche (informations pertinentes)
 */
export interface TaskContext {
  /** Fichiers pertinents pour la tâche */
  files?: string[];

  /** Extraits de code pertinents */
  codeSnippets?: CodeSnippet[];

  /** Résultats de tâches précédentes */
  previousResults?: TaskResult[];

  /** Dossier de travail */
  workingDirectory?: string;

  /** Erreurs à corriger (pour Fixer Agent) */
  errors?: unknown[];

  /** Issues de review (pour Fixer Agent) */
  reviewIssues?: unknown[];

  /** Artefacts de tâches précédentes */
  artifacts?: unknown[];

  /** Informations supplémentaires */
  additionalInfo?: Record<string, unknown>;
}

/**
 * Extrait de code
 */
export interface CodeSnippet {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  language?: string;
}

/**
 * Métadonnées d'une tâche
 */
export interface TaskMetadata {
  /** ID de la tâche parente (si sous-tâche) */
  parentTaskId?: string;

  /** Nombre de retries effectués */
  retryCount?: number;

  /** Source de la tâche */
  source?: 'user' | 'orchestrator' | 'agent';

  /** Tags pour catégorisation */
  tags?: string[];
}

// ============================================================================
// RÉSULTATS
// ============================================================================

/**
 * Résultat d'une tâche
 */
export interface TaskResult {
  /** Succès ou échec */
  success: boolean;

  /** Message/sortie principale */
  output: string;

  /** Artefacts générés */
  artifacts?: Artifact[];

  /** Erreurs rencontrées */
  errors?: AgentError[];

  /** Métriques d'exécution */
  metrics?: TaskMetrics;

  /** Sous-tâches créées */
  subTasks?: Task[];

  /** Données structurées (JSON) */
  data?: Record<string, unknown>;
}

/**
 * Artefact généré par un agent
 */
export interface Artifact {
  /** Type d'artefact */
  type: 'file' | 'code' | 'command' | 'message' | 'analysis';

  /** Chemin du fichier (si applicable) */
  path?: string;

  /** Contenu */
  content: string;

  /** Langage (si code) */
  language?: string;

  /** Titre/description */
  title?: string;

  /** Action effectuée */
  action?: 'created' | 'modified' | 'deleted' | 'read';
}

/**
 * Erreur d'un agent
 */
export interface AgentError {
  /** Code d'erreur */
  code: string;

  /** Message d'erreur */
  message: string;

  /** Est-ce récupérable ? */
  recoverable: boolean;

  /** Suggestion de correction */
  suggestion?: string;

  /** Stack trace (si disponible) */
  stack?: string;

  /** Contexte additionnel */
  context?: Record<string, unknown>;
}

/**
 * Métriques d'exécution d'une tâche
 */
export interface TaskMetrics {
  /** Tokens utilisés en entrée */
  inputTokens: number;

  /** Tokens utilisés en sortie */
  outputTokens: number;

  /** Temps d'exécution total (ms) */
  executionTime: number;

  /** Nombre d'appels d'outils */
  toolCalls: number;

  /** Nombre d'appels LLM */
  llmCalls: number;

  /** Temps passé dans les outils (ms) */
  toolExecutionTime: number;
}

// ============================================================================
// MESSAGES ET COMMUNICATION
// ============================================================================

/**
 * Message dans la conversation avec un agent
 */
export interface AgentMessage {
  /** Rôle du message */
  role: 'user' | 'assistant' | 'system';

  /** Contenu textuel */
  content: string;

  /** Appels d'outils (si assistant) */
  toolCalls?: ToolCall[];

  /** Résultats d'outils (si user après tool_use) */
  toolResults?: ToolResult[];

  /** Timestamp */
  timestamp?: Date;
}

/**
 * Appel d'outil par l'assistant
 */
export interface ToolCall {
  /** ID unique de l'appel */
  id: string;

  /** Nom de l'outil */
  name: string;

  /** Paramètres d'entrée */
  input: Record<string, unknown>;
}

/**
 * Résultat d'un appel d'outil
 */
export interface ToolResult {
  /** ID de l'appel d'outil correspondant */
  toolCallId: string;

  /** Résultat */
  output: unknown;

  /** Erreur éventuelle */
  error?: string;

  /** Est-ce une erreur ? */
  isError?: boolean;
}

// ============================================================================
// ORCHESTRATION
// ============================================================================

/**
 * Décision de l'orchestrateur
 */
export interface OrchestrationDecision {
  /** Action à effectuer */
  action: 'delegate' | 'execute_directly' | 'decompose' | 'ask_user' | 'complete';

  /** Agent cible (si delegate) */
  targetAgent?: AgentType;

  /** Tâches à créer (si decompose) */
  subTasks?: Omit<Task, 'id' | 'status' | 'createdAt'>[];

  /** Réponse directe (si execute_directly ou complete) */
  response?: string;

  /** Question pour l'utilisateur (si ask_user) */
  question?: string;

  /** Raisonnement de la décision */
  reasoning: string;
}

/**
 * Plan d'exécution créé par l'orchestrateur
 */
export interface ExecutionPlan {
  /** ID du plan */
  id: string;

  /** Tâche originale */
  originalTask: Task;

  /** Étapes du plan */
  steps: ExecutionStep[];

  /** Statut global */
  status: 'planning' | 'executing' | 'completed' | 'failed';

  /** Résultat final */
  finalResult?: TaskResult;
}

/**
 * Étape d'un plan d'exécution
 */
export interface ExecutionStep {
  /** Ordre d'exécution */
  order: number;

  /** Agent responsable */
  agent: AgentType;

  /** Tâche à exécuter */
  task: Task;

  /** Peut s'exécuter en parallèle avec d'autres étapes ? */
  parallel?: boolean;

  /** Étapes dont celle-ci dépend */
  dependsOn?: number[];
}

// ============================================================================
// ÉVÉNEMENTS
// ============================================================================

/**
 * Type d'événement du système d'agents
 */
export type AgentEventType =
  | 'agent:started'
  | 'agent:completed'
  | 'agent:failed'
  | 'agent:tool_call'
  | 'agent:tool_result'
  | 'task:created'
  | 'task:started'
  | 'task:progress'
  | 'task:completed'
  | 'task:failed'
  | 'orchestrator:decision'
  | 'orchestrator:delegated';

/**
 * Événement du système d'agents
 */
export interface AgentEvent {
  /** Type d'événement */
  type: AgentEventType;

  /** Timestamp */
  timestamp: Date;

  /** Agent concerné */
  agentName?: AgentType;

  /** Tâche concernée */
  taskId?: string;

  /** Données de l'événement */
  data: Record<string, unknown>;
}

/**
 * Callback pour les événements
 */
export type AgentEventCallback = (event: AgentEvent) => void;

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Niveau de log
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Entrée de log
 */
export interface LogEntry {
  /** Niveau */
  level: LogLevel;

  /** Message */
  message: string;

  /** Timestamp */
  timestamp: Date;

  /** Agent source */
  agentName?: AgentType;

  /** ID de tâche */
  taskId?: string;

  /** Données additionnelles */
  data?: Record<string, unknown>;
}

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Modèle par défaut pour tous les agents
 */
export const DEFAULT_MODEL: AgentModel = 'claude-sonnet-4-5-20250929';

/**
 * Configuration par défaut
 */
export const DEFAULT_CONFIG = {
  maxTokens: 8192,
  temperature: 0.2,
  timeout: 300000, // 5 minutes
  maxRetries: 3,
  maxParallelAgents: 5,
} as const;

/**
 * Descriptions des agents pour l'orchestrateur
 */
export const AGENT_DESCRIPTIONS: Record<AgentType, string> = {
  orchestrator:
    'Agent principal qui coordonne les autres agents. Analyse les demandes, ' +
    'décompose les tâches complexes, et délègue aux agents spécialisés.',

  explore:
    'Agent d\'exploration en LECTURE SEULE. Spécialisé dans la recherche de fichiers, ' +
    'l\'analyse de code, la navigation dans le codebase. Utilise grep, glob, read.',

  coder:
    'Agent de développement. Peut créer, modifier, et supprimer des fichiers de code. ' +
    'Spécialisé dans l\'écriture de code propre et fonctionnel.',

  builder:
    'Agent de build et exécution. Lance les commandes npm, les scripts shell, ' +
    'démarre les serveurs de développement. Gère les dépendances.',

  tester:
    'Agent de test. Lance les tests unitaires, d\'intégration, E2E. ' +
    'Analyse les résultats et rapporte la couverture de code.',

  deployer:
    'Agent de déploiement. Gère les opérations Git (commit, push, pull), ' +
    'crée des repos GitHub, des pull requests, et déploie les applications.',

  reviewer:
    'Agent de review de code. Analyse la qualité, la sécurité, et la performance du code. ' +
    'Détecte les code smells, calcule la complexité, et suggère des améliorations.',

  fixer:
    'Agent de correction automatique. Corrige les erreurs de test, de compilation, ' +
    'et les problèmes de sécurité identifiés par les autres agents.',
};
