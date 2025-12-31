/**
 * Badge de statut des agents
 *
 * Affiche un indicateur compact du nombre d'agents actifs
 * et permet d'ouvrir le panneau d'activité détaillé.
 */

import { memo, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import {
  activeAgentsStore,
  agentStatusStore,
  activeAgentCountStore,
  agentStatsStore,
} from '~/lib/stores/agents';
import type { AgentType, AgentStatus } from '~/lib/agents/types';

// ============================================================================
// TYPES
// ============================================================================

interface AgentStatusBadgeProps {
  /** Callback quand on clique sur le badge */
  onClick?: () => void;
  /** Afficher la version compacte ? */
  compact?: boolean;
  /** Classes CSS additionnelles */
  className?: string;
}

interface AgentDotProps {
  agent: AgentType;
  status: AgentStatus;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Obtient la couleur pour un statut d'agent
 */
function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case 'idle':
      return 'bg-gray-400';
    case 'thinking':
      return 'bg-yellow-400';
    case 'executing':
      return 'bg-green-400';
    case 'waiting_for_tool':
      return 'bg-blue-400';
    case 'completed':
      return 'bg-green-500';
    case 'failed':
      return 'bg-red-500';
    case 'aborted':
      return 'bg-orange-500';
    default:
      return 'bg-gray-400';
  }
}

/**
 * Obtient le label pour un statut d'agent
 */
function getStatusLabel(status: AgentStatus): string {
  switch (status) {
    case 'idle':
      return 'En attente';
    case 'thinking':
      return 'Réflexion...';
    case 'executing':
      return 'Exécution...';
    case 'waiting_for_tool':
      return 'Attente outil';
    case 'completed':
      return 'Terminé';
    case 'failed':
      return 'Échec';
    case 'aborted':
      return 'Annulé';
    default:
      return status;
  }
}

/**
 * Obtient l'icône de l'agent
 */
function getAgentIcon(agent: AgentType): string {
  const icons: Record<AgentType, string> = {
    orchestrator: 'i-ph:brain',
    explore: 'i-ph:magnifying-glass',
    coder: 'i-ph:code',
    builder: 'i-ph:hammer',
    tester: 'i-ph:test-tube',
    deployer: 'i-ph:rocket-launch',
    reviewer: 'i-ph:eye',
    fixer: 'i-ph:wrench',
  };
  return icons[agent] || 'i-ph:robot';
}

/**
 * Obtient le nom affiché de l'agent
 */
function getAgentDisplayName(agent: AgentType): string {
  const names: Record<AgentType, string> = {
    orchestrator: 'Orchestrator',
    explore: 'Explorer',
    coder: 'Coder',
    builder: 'Builder',
    tester: 'Tester',
    deployer: 'Deployer',
    reviewer: 'Reviewer',
    fixer: 'Fixer',
  };
  return names[agent] || agent;
}

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Point indicateur pour un agent
 */
const AgentDot = memo(({ agent, status }: AgentDotProps) => {
  const isActive = status !== 'idle' && status !== 'completed' && status !== 'failed' && status !== 'aborted';
  const color = getStatusColor(status);

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      className="relative group"
      title={`${getAgentDisplayName(agent)}: ${getStatusLabel(status)}`}
    >
      <div
        className={classNames(
          'w-2.5 h-2.5 rounded-full',
          color,
          isActive ? 'animate-pulse' : ''
        )}
      />
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-bolt-elements-background-depth-4 rounded text-xs text-bolt-elements-textPrimary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        <div className="flex items-center gap-1.5">
          <div className={classNames(getAgentIcon(agent), 'text-xs')} />
          <span>{getAgentDisplayName(agent)}</span>
        </div>
        <div className="text-bolt-elements-textSecondary text-[10px]">
          {getStatusLabel(status)}
        </div>
      </div>
    </motion.div>
  );
});

AgentDot.displayName = 'AgentDot';

/**
 * Liste des agents actifs (version étendue)
 */
const ActiveAgentsList = memo(() => {
  const activeAgents = useStore(activeAgentsStore);
  const statuses = useStore(agentStatusStore);

  if (activeAgents.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <AnimatePresence mode="popLayout">
        {activeAgents.map(agent => (
          <AgentDot key={agent} agent={agent} status={statuses[agent]} />
        ))}
      </AnimatePresence>
    </div>
  );
});

ActiveAgentsList.displayName = 'ActiveAgentsList';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AgentStatusBadge = memo(({
  onClick,
  compact = false,
  className,
}: AgentStatusBadgeProps) => {
  const activeCount = useStore(activeAgentCountStore);
  const stats = useStore(agentStatsStore);
  const activeAgents = useStore(activeAgentsStore);
  const statuses = useStore(agentStatusStore);

  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  // Rien à afficher si aucun agent actif et mode compact
  if (compact && activeCount === 0) {
    return null;
  }

  return (
    <motion.button
      onClick={handleClick}
      className={classNames(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors',
        'hover:bg-bolt-elements-background-depth-3',
        'border border-bolt-elements-borderColor',
        activeCount > 0
          ? 'bg-accent-500/10 border-accent-500/30'
          : 'bg-bolt-elements-background-depth-2',
        className
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Robot icon */}
      <div className={classNames(
        'i-ph:robot text-lg',
        activeCount > 0 ? 'text-accent-400' : 'text-bolt-elements-textSecondary'
      )} />

      {/* Active count */}
      <span className={classNames(
        'text-sm font-medium',
        activeCount > 0 ? 'text-accent-400' : 'text-bolt-elements-textSecondary'
      )}>
        {activeCount > 0 ? `${activeCount} actif${activeCount > 1 ? 's' : ''}` : 'Agents'}
      </span>

      {/* Active agents dots */}
      {!compact && activeCount > 0 && (
        <div className="flex items-center gap-1 ml-1">
          <AnimatePresence mode="popLayout">
            {activeAgents.slice(0, 4).map(agent => (
              <motion.div
                key={agent}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className={classNames(
                  'w-2 h-2 rounded-full',
                  getStatusColor(statuses[agent]),
                  'animate-pulse'
                )}
                title={getAgentDisplayName(agent)}
              />
            ))}
            {activeAgents.length > 4 && (
              <span className="text-xs text-bolt-elements-textTertiary">
                +{activeAgents.length - 4}
              </span>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Expand icon */}
      <div className="i-ph:caret-right text-xs text-bolt-elements-textTertiary" />
    </motion.button>
  );
});

AgentStatusBadge.displayName = 'AgentStatusBadge';

/**
 * Bouton STOP global pour arrêter tous les agents
 */
export const AgentStopButton = memo(({
  onStop,
  disabled = false,
  className,
}: {
  onStop: () => void;
  disabled?: boolean;
  className?: string;
}) => {
  const activeCount = useStore(activeAgentCountStore);

  // Ne pas afficher si aucun agent actif
  if (activeCount === 0) {
    return null;
  }

  return (
    <motion.button
      onClick={onStop}
      disabled={disabled}
      className={classNames(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors',
        'bg-red-500/20 hover:bg-red-500/30 border border-red-500/50',
        'text-red-400 disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <div className="i-ph:stop-circle text-lg" />
      <span className="text-sm font-medium">STOP</span>
    </motion.button>
  );
});

AgentStopButton.displayName = 'AgentStopButton';

/**
 * Indicateur de chargement des agents
 */
export const AgentLoadingIndicator = memo(({
  agent,
  message,
}: {
  agent?: AgentType;
  message?: string;
}) => {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor">
      <div className="i-svg-spinners:90-ring-with-bg text-accent-400" />
      {agent && (
        <div className={classNames(getAgentIcon(agent), 'text-bolt-elements-textSecondary')} />
      )}
      <span className="text-sm text-bolt-elements-textSecondary">
        {message || (agent ? `${getAgentDisplayName(agent)} en cours...` : 'Traitement...')}
      </span>
    </div>
  );
});

AgentLoadingIndicator.displayName = 'AgentLoadingIndicator';
