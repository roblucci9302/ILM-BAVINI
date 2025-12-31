import { map, atom } from 'nanostores';
import type {
  ProposedAction,
  PendingActionBatch,
  ValidationStatus,
} from '~/lib/agents/security/action-validator';
import type { AgentType } from '~/lib/agents/types';

/**
 * Mode d'opération du chat
 * - 'chat': Mode analyse uniquement (lecture seule, pas de modifications)
 * - 'agent': Mode action (BAVINI peut créer/modifier du code) - DÉFAUT
 */
export type ChatMode = 'chat' | 'agent';

/**
 * Mode de contrôle des agents
 * - 'strict': Chaque action nécessite une approbation
 * - 'moderate': Seules les actions dangereuses nécessitent une approbation
 * - 'permissive': Seules les suppressions et commandes shell nécessitent une approbation
 */
export type AgentControlMode = 'strict' | 'moderate' | 'permissive';

export interface ChatState {
  /** Le chat a-t-il démarré */
  started: boolean;
  /** Le chat a-t-il été interrompu */
  aborted: boolean;
  /** Afficher le panneau de chat */
  showChat: boolean;
  /** Mode d'opération actuel */
  mode: ChatMode;
  /** Mode de contrôle des agents */
  controlMode: AgentControlMode;
  /** Le mode Agent est-il en attente de validation */
  awaitingAgentApproval: boolean;
}

export const chatStore = map<ChatState>({
  started: false,
  aborted: false,
  showChat: true,
  mode: 'agent',
  controlMode: 'strict', // Mode strict par défaut
  awaitingAgentApproval: false,
});

// ============================================================================
// STORES POUR L'APPROBATION DES ACTIONS
// ============================================================================

/**
 * Batch d'actions actuellement en attente d'approbation
 */
export const pendingBatchStore = atom<PendingActionBatch | null>(null);

/**
 * Historique des batches traités (approuvés ou rejetés)
 */
export const processedBatchesStore = atom<Array<PendingActionBatch & { processedAt: Date }>>([]);

/**
 * Modal d'approbation ouvert ?
 */
export const approvalModalOpenStore = atom<boolean>(false);

/**
 * Panneau d'activité des agents ouvert ?
 */
export const activityPanelOpenStore = atom<boolean>(false);

// ============================================================================
// ACTIONS DU CHAT STORE
// ============================================================================

/**
 * Change le mode du chat
 */
export function setChatMode(mode: ChatMode): void {
  chatStore.setKey('mode', mode);
}

/**
 * Retourne le mode actuel
 */
export function getChatMode(): ChatMode {
  return chatStore.get().mode;
}

/**
 * Change le mode de contrôle des agents
 */
export function setAgentControlMode(mode: AgentControlMode): void {
  chatStore.setKey('controlMode', mode);
}

/**
 * Retourne le mode de contrôle actuel
 */
export function getAgentControlMode(): AgentControlMode {
  return chatStore.get().controlMode;
}

// ============================================================================
// ACTIONS D'APPROBATION
// ============================================================================

/**
 * Soumet un batch d'actions pour approbation
 */
export function submitBatchForApproval(batch: PendingActionBatch): void {
  pendingBatchStore.set(batch);
  approvalModalOpenStore.set(true);
  chatStore.setKey('awaitingAgentApproval', true);
}

/**
 * Approuve toutes les actions du batch en cours
 */
export function approveAllActions(): ProposedAction[] {
  const batch = pendingBatchStore.get();

  if (!batch) {
    return [];
  }

  // Marquer toutes les actions comme approuvées
  const approvedActions = batch.actions.map(action => ({
    ...action,
    status: 'approved' as ValidationStatus,
    validatedAt: new Date(),
  }));

  // Ajouter à l'historique
  const processedBatch: PendingActionBatch & { processedAt: Date } = {
    ...batch,
    actions: approvedActions,
    status: 'approved',
    processedAt: new Date(),
  };

  processedBatchesStore.set([
    ...processedBatchesStore.get().slice(-49), // Garder les 50 derniers
    processedBatch,
  ]);

  // Réinitialiser
  pendingBatchStore.set(null);
  approvalModalOpenStore.set(false);
  chatStore.setKey('awaitingAgentApproval', false);

  return approvedActions;
}

/**
 * Approuve seulement certaines actions du batch
 */
export function approveSelectedActions(actionIds: string[]): ProposedAction[] {
  const batch = pendingBatchStore.get();

  if (!batch) {
    return [];
  }

  const selectedSet = new Set(actionIds);

  // Marquer les actions sélectionnées comme approuvées, les autres comme rejetées
  const processedActions = batch.actions.map(action => ({
    ...action,
    status: selectedSet.has(action.id) ? 'approved' as ValidationStatus : 'rejected' as ValidationStatus,
    validatedAt: new Date(),
    rejectionReason: selectedSet.has(action.id) ? undefined : 'Non sélectionné par l\'utilisateur',
  }));

  const approvedActions = processedActions.filter(a => a.status === 'approved');

  // Ajouter à l'historique
  const processedBatch: PendingActionBatch & { processedAt: Date } = {
    ...batch,
    actions: processedActions,
    status: approvedActions.length > 0 ? 'partially_approved' : 'rejected',
    processedAt: new Date(),
  };

  processedBatchesStore.set([
    ...processedBatchesStore.get().slice(-49),
    processedBatch,
  ]);

  // Réinitialiser
  pendingBatchStore.set(null);
  approvalModalOpenStore.set(false);
  chatStore.setKey('awaitingAgentApproval', false);

  return approvedActions;
}

/**
 * Rejette toutes les actions du batch en cours
 */
export function rejectAllActions(): void {
  const batch = pendingBatchStore.get();

  if (!batch) {
    return;
  }

  // Marquer toutes les actions comme rejetées
  const rejectedActions = batch.actions.map(action => ({
    ...action,
    status: 'rejected' as ValidationStatus,
    validatedAt: new Date(),
    rejectionReason: 'Rejeté par l\'utilisateur',
  }));

  // Ajouter à l'historique
  const processedBatch: PendingActionBatch & { processedAt: Date } = {
    ...batch,
    actions: rejectedActions,
    status: 'rejected',
    processedAt: new Date(),
  };

  processedBatchesStore.set([
    ...processedBatchesStore.get().slice(-49),
    processedBatch,
  ]);

  // Réinitialiser
  pendingBatchStore.set(null);
  approvalModalOpenStore.set(false);
  chatStore.setKey('awaitingAgentApproval', false);
}

/**
 * Ferme le modal d'approbation sans décision
 * (le batch reste en attente)
 */
export function closeApprovalModal(): void {
  approvalModalOpenStore.set(false);
}

/**
 * Rouvre le modal d'approbation s'il y a un batch en attente
 */
export function reopenApprovalModal(): void {
  if (pendingBatchStore.get()) {
    approvalModalOpenStore.set(true);
  }
}

// ============================================================================
// PANNEAU D'ACTIVITÉ
// ============================================================================

/**
 * Ouvre/ferme le panneau d'activité des agents
 */
export function toggleActivityPanel(open?: boolean): void {
  const current = activityPanelOpenStore.get();
  activityPanelOpenStore.set(open !== undefined ? open : !current);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Vérifie si une approbation est en attente
 */
export function hasApprovalPending(): boolean {
  return pendingBatchStore.get() !== null;
}

/**
 * Obtient le nombre d'actions en attente
 */
export function getPendingActionsCount(): number {
  const batch = pendingBatchStore.get();
  return batch ? batch.actions.length : 0;
}

/**
 * Vérifie si le mode strict est actif
 */
export function isStrictMode(): boolean {
  return chatStore.get().controlMode === 'strict';
}

// ============================================================================
// LEGACY COMPATIBILITY (pour les anciens composants)
// ============================================================================

/**
 * @deprecated Utiliser submitBatchForApproval à la place
 */
export function setPendingActions(actions: ProposedAction[]): void {
  if (actions.length === 0) {
    pendingBatchStore.set(null);
    chatStore.setKey('awaitingAgentApproval', false);
    return;
  }

  const batch: PendingActionBatch = {
    id: `batch-${Date.now()}`,
    agent: actions[0]?.agent || 'orchestrator',
    actions,
    description: `${actions.length} action(s) en attente`,
    createdAt: new Date(),
    status: 'pending',
  };

  submitBatchForApproval(batch);
}

/**
 * @deprecated Utiliser rejectAllActions à la place
 */
export function clearPendingActions(): void {
  rejectAllActions();
}

/**
 * @deprecated Utiliser approveAllActions à la place
 */
export function approveAgentMode(): ProposedAction[] {
  return approveAllActions();
}

/**
 * @deprecated Utiliser rejectAllActions à la place
 */
export function rejectAgentMode(): void {
  rejectAllActions();
}
