/**
 * Types et interfaces pour le système d'agents BAVINI
 *
 * Ce module définit les contrats pour les agents Chat Mode et Agent Mode,
 * permettant une analyse intelligente avant l'exécution d'actions.
 */

// =============================================================================
// Agent Capabilities & Restrictions
// =============================================================================

/**
 * Capacités disponibles pour les agents
 */
export type AgentCapability =
  | 'read_files'
  | 'analyze_code'
  | 'inspect_logs'
  | 'explain_errors'
  | 'suggest_solutions'
  | 'plan_features'
  | 'create_files'
  | 'modify_files'
  | 'execute_shell'
  | 'install_packages'
  | 'deploy';

/**
 * Modes d'opération des agents
 */
export type AgentMode = 'chat' | 'agent' | 'auto';

// =============================================================================
// Intent Classification
// =============================================================================

/**
 * Types d'intentions utilisateur détectées
 */
export type IntentType =
  | 'debug'      // Déboguer un problème
  | 'explain'    // Expliquer le code/fonctionnement
  | 'plan'       // Planifier une fonctionnalité
  | 'review'     // Revoir/évaluer le code
  | 'question'   // Question technique générale
  | 'create'     // Créer quelque chose de nouveau
  | 'modify'     // Modifier le code existant
  | 'fix'        // Corriger une erreur
  | 'refactor'   // Refactorer le code
  | 'unknown';   // Intention non déterminée

/**
 * Résultat de la classification d'intention
 */
export interface IntentClassification {
  /** Type d'intention détecté */
  type: IntentType;
  /** Score de confiance (0-1) */
  confidence: number;
  /** Entités extraites du message */
  entities: ExtractedEntities;
  /** Mode recommandé basé sur l'intention */
  recommendedMode: AgentMode;
  /** Raison de la recommandation */
  reasoning: string;
}

/**
 * Entités extraites du message utilisateur
 */
export interface ExtractedEntities {
  /** Fichiers mentionnés */
  files: string[];
  /** Composants/modules mentionnés */
  components: string[];
  /** Technologies/frameworks mentionnés */
  technologies: string[];
  /** Actions demandées */
  actions: string[];
  /** Erreurs/problèmes mentionnés */
  errors: string[];
}

// =============================================================================
// Agent Context
// =============================================================================

/**
 * Contexte fourni à l'agent pour l'analyse
 */
export interface AgentContext {
  /** Fichiers du projet pertinents */
  files: ProjectFile[];
  /** Historique des messages */
  messageHistory: AgentMessage[];
  /** État actuel du projet */
  projectState: ProjectState;
  /** Erreurs récentes */
  recentErrors: ProjectError[];
  /** Logs récents */
  recentLogs: string[];
}

/**
 * Fichier du projet
 */
export interface ProjectFile {
  path: string;
  content: string;
  language: string;
  lastModified?: Date;
}

/**
 * Message dans l'historique
 */
export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  mode?: AgentMode;
}

/**
 * État du projet
 */
export interface ProjectState {
  /** Le projet est-il en cours de build */
  isBuilding: boolean;
  /** Le projet a-t-il des erreurs */
  hasErrors: boolean;
  /** Nombre de fichiers */
  fileCount: number;
  /** Stack technique détectée */
  techStack: string[];
  /** Score de qualité actuel */
  qualityScore?: number;
}

/**
 * Erreur du projet
 */
export interface ProjectError {
  type: 'build' | 'runtime' | 'lint' | 'type';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  timestamp: Date;
}

// =============================================================================
// Agent Responses
// =============================================================================

/**
 * Réponse du Chat Mode Agent
 */
export interface ChatModeResponse {
  /** Type de réponse */
  type: 'analysis';
  /** Contenu de l'analyse */
  content: string;
  /** Sections structurées de la réponse */
  sections: ChatResponseSections;
  /** Suggestions d'amélioration */
  suggestions: string[];
  /** Peut-on passer en mode Agent ? */
  canProceedToAgentMode: boolean;
  /** Actions proposées si passage en Agent Mode */
  proposedActions: ProposedAction[];
}

/**
 * Sections de la réponse Chat Mode
 */
export interface ChatResponseSections {
  /** Analyse de la situation */
  analysis?: string;
  /** Diagnostic du problème */
  diagnostic?: string;
  /** Suggestions d'amélioration */
  suggestions?: string;
  /** Prochaines étapes */
  nextSteps?: string;
}

/**
 * Réponse du Agent Mode
 */
export interface AgentModeResponse {
  /** Type de réponse */
  type: 'execution';
  /** Plan d'exécution */
  executionPlan: ExecutionPlan;
  /** Résultats des actions */
  results: ActionResult[];
  /** Résumé de l'exécution */
  summary: string;
  /** Erreurs rencontrées */
  errors: ExecutionError[];
}

// =============================================================================
// Execution Planning
// =============================================================================

/**
 * Plan d'exécution pour le Agent Mode
 */
export interface ExecutionPlan {
  /** ID unique du plan */
  id: string;
  /** Description du plan */
  description: string;
  /** Actions à exécuter */
  actions: ProposedAction[];
  /** Ordre d'exécution */
  executionOrder: string[];
  /** Dépendances entre actions */
  dependencies: ActionDependency[];
  /** Estimations */
  estimates: PlanEstimates;
  /** Le plan nécessite-t-il validation ? */
  requiresApproval: boolean;
}

/**
 * Action proposée
 */
export interface ProposedAction {
  /** ID unique de l'action */
  id: string;
  /** Type d'action */
  type: ActionType;
  /** Description lisible */
  description: string;
  /** Détails de l'action */
  details: ActionDetails;
  /** Risque associé */
  risk: 'low' | 'medium' | 'high';
  /** Action réversible ? */
  reversible: boolean;
}

/**
 * Types d'actions possibles
 */
export type ActionType =
  | 'create_file'
  | 'modify_file'
  | 'delete_file'
  | 'run_command'
  | 'install_package'
  | 'git_operation'
  | 'deploy';

/**
 * Détails spécifiques à chaque type d'action
 */
export type ActionDetails =
  | CreateFileDetails
  | ModifyFileDetails
  | DeleteFileDetails
  | RunCommandDetails
  | InstallPackageDetails
  | GitOperationDetails
  | DeployDetails;

export interface CreateFileDetails {
  type: 'create_file';
  path: string;
  content: string;
  language: string;
}

export interface ModifyFileDetails {
  type: 'modify_file';
  path: string;
  changes: FileChange[];
}

export interface FileChange {
  startLine: number;
  endLine: number;
  oldContent: string;
  newContent: string;
}

export interface DeleteFileDetails {
  type: 'delete_file';
  path: string;
}

export interface RunCommandDetails {
  type: 'run_command';
  command: string;
  workingDirectory?: string;
}

export interface InstallPackageDetails {
  type: 'install_package';
  packageName: string;
  version?: string;
  isDev: boolean;
}

export interface GitOperationDetails {
  type: 'git_operation';
  operation: 'commit' | 'push' | 'pull' | 'branch' | 'merge';
  params: Record<string, string>;
}

export interface DeployDetails {
  type: 'deploy';
  platform: string;
  environment: string;
}

/**
 * Dépendance entre actions
 */
export interface ActionDependency {
  actionId: string;
  dependsOn: string[];
}

/**
 * Estimations du plan
 */
export interface PlanEstimates {
  /** Nombre total d'actions */
  totalActions: number;
  /** Fichiers à créer */
  filesToCreate: number;
  /** Fichiers à modifier */
  filesToModify: number;
  /** Commandes à exécuter */
  commandsToRun: number;
}

// =============================================================================
// Action Results
// =============================================================================

/**
 * Résultat d'une action exécutée
 */
export interface ActionResult {
  /** ID de l'action */
  actionId: string;
  /** Succès ou échec */
  success: boolean;
  /** Message de résultat */
  message: string;
  /** Sortie de la commande si applicable */
  output?: string;
  /** Durée d'exécution en ms */
  duration: number;
  /** Données de rollback */
  rollbackData?: RollbackData;
}

/**
 * Données pour annuler une action
 */
export interface RollbackData {
  actionId: string;
  type: ActionType;
  data: unknown;
}

/**
 * Erreur d'exécution
 */
export interface ExecutionError {
  actionId: string;
  code: string;
  message: string;
  stack?: string;
  recoverable: boolean;
}

// =============================================================================
// Agent Configuration
// =============================================================================

/**
 * Configuration d'un agent
 */
export interface AgentConfig {
  /** Mode de l'agent */
  mode: AgentMode;
  /** Capacités activées */
  capabilities: AgentCapability[];
  /** Restrictions */
  restrictions: AgentCapability[];
  /** Langue de réponse */
  language: 'fr' | 'en';
  /** Verbosité des réponses */
  verbosity: 'concise' | 'normal' | 'detailed';
  /** Validation automatique ou manuelle */
  autoApprove: boolean;
}

/**
 * Configuration par défaut du Chat Mode
 */
export const CHAT_MODE_CONFIG: AgentConfig = {
  mode: 'chat',
  capabilities: [
    'read_files',
    'analyze_code',
    'inspect_logs',
    'explain_errors',
    'suggest_solutions',
    'plan_features',
  ],
  restrictions: [
    'create_files',
    'modify_files',
    'execute_shell',
    'install_packages',
    'deploy',
  ],
  language: 'fr',
  verbosity: 'normal',
  autoApprove: false,
};

/**
 * Configuration par défaut du Agent Mode
 */
export const AGENT_MODE_CONFIG: AgentConfig = {
  mode: 'agent',
  capabilities: [
    'read_files',
    'analyze_code',
    'inspect_logs',
    'explain_errors',
    'suggest_solutions',
    'plan_features',
    'create_files',
    'modify_files',
    'execute_shell',
    'install_packages',
    'deploy',
  ],
  restrictions: [],
  language: 'fr',
  verbosity: 'normal',
  autoApprove: false,
};
