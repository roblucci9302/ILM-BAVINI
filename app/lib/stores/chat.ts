import { map } from 'nanostores';
import type { ProposedAction } from '~/lib/.server/agents/types';

/**
 * Mode d'opération du chat
 * - 'chat': Mode analyse uniquement (lecture seule)
 * - 'agent': Mode action (modifications autorisées)
 * - 'auto': Détection automatique selon l'intention
 */
export type ChatMode = 'chat' | 'agent' | 'auto';

export interface ChatState {
  /** Le chat a-t-il démarré */
  started: boolean;
  /** Le chat a-t-il été interrompu */
  aborted: boolean;
  /** Afficher le panneau de chat */
  showChat: boolean;
  /** Mode d'opération actuel */
  mode: ChatMode;
  /** Actions proposées en attente de validation */
  pendingActions: ProposedAction[];
  /** Le mode Agent est-il en attente de validation */
  awaitingAgentApproval: boolean;
}

export const chatStore = map<ChatState>({
  started: false,
  aborted: false,
  showChat: true,
  mode: 'auto',
  pendingActions: [],
  awaitingAgentApproval: false,
});

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
 * Définit les actions en attente de validation
 */
export function setPendingActions(actions: ProposedAction[]): void {
  chatStore.setKey('pendingActions', actions);
  chatStore.setKey('awaitingAgentApproval', actions.length > 0);
}

/**
 * Efface les actions en attente
 */
export function clearPendingActions(): void {
  chatStore.setKey('pendingActions', []);
  chatStore.setKey('awaitingAgentApproval', false);
}

/**
 * Approuve le passage en mode Agent avec les actions proposées
 */
export function approveAgentMode(): ProposedAction[] {
  const actions = chatStore.get().pendingActions;
  chatStore.setKey('mode', 'agent');
  chatStore.setKey('awaitingAgentApproval', false);
  return actions;
}

/**
 * Refuse le passage en mode Agent
 */
export function rejectAgentMode(): void {
  chatStore.setKey('pendingActions', []);
  chatStore.setKey('awaitingAgentApproval', false);
}
