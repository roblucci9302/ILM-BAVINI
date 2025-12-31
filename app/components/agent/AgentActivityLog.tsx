/**
 * Historique des activités des agents
 *
 * Affiche un log en temps réel de toutes les actions des agents,
 * leur statut, et le résultat de chaque opération.
 */

import { memo, useCallback, useRef, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { systemLogsStore, agentStatsStore, type LogEntry } from '~/lib/stores/agents';
import type { AgentType, LogLevel } from '~/lib/agents/types';

// ============================================================================
// TYPES
// ============================================================================

interface AgentActivityLogProps {
  /** Le panneau est-il ouvert ? */
  isOpen: boolean;
  /** Callback pour fermer */
  onClose: () => void;
  /** Nombre max de logs à afficher */
  maxLogs?: number;
  /** Auto-scroll vers le bas ? */
  autoScroll?: boolean;
}

interface LogItemProps {
  log: LogEntry;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Formate un timestamp en heure locale
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Formate le temps écoulé
 */
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `il y a ${seconds}s`;
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)}min`;
  return `il y a ${Math.floor(seconds / 3600)}h`;
}

/**
 * Obtient la couleur du niveau de log
 */
function getLogLevelColor(level: LogLevel): string {
  switch (level) {
    case 'debug':
      return 'text-gray-400';
    case 'info':
      return 'text-blue-400';
    case 'warn':
      return 'text-yellow-400';
    case 'error':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

/**
 * Obtient l'icône du niveau de log
 */
function getLogLevelIcon(level: LogLevel): string {
  switch (level) {
    case 'debug':
      return 'i-ph:bug';
    case 'info':
      return 'i-ph:info';
    case 'warn':
      return 'i-ph:warning';
    case 'error':
      return 'i-ph:x-circle';
    default:
      return 'i-ph:circle';
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
 * Obtient la couleur de l'agent
 */
function getAgentColor(agent: AgentType): string {
  const colors: Record<AgentType, string> = {
    orchestrator: 'text-purple-400',
    explore: 'text-cyan-400',
    coder: 'text-green-400',
    builder: 'text-orange-400',
    tester: 'text-yellow-400',
    deployer: 'text-pink-400',
    reviewer: 'text-blue-400',
    fixer: 'text-red-400',
  };
  return colors[agent] || 'text-gray-400';
}

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Item de log individuel
 */
const LogItem = memo(({ log }: LogItemProps) => {
  const levelColor = getLogLevelColor(log.level);
  const levelIcon = getLogLevelIcon(log.level);
  const agentIcon = log.agentName ? getAgentIcon(log.agentName) : '';
  const agentColor = log.agentName ? getAgentColor(log.agentName) : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 py-2 px-3 hover:bg-bolt-elements-background-depth-3 transition-colors text-sm"
    >
      {/* Timestamp */}
      <span className="text-xs text-bolt-elements-textTertiary font-mono w-16 flex-shrink-0">
        {formatTime(log.timestamp)}
      </span>

      {/* Level icon */}
      <div className={classNames(levelIcon, levelColor, 'text-base flex-shrink-0')} />

      {/* Agent badge */}
      {log.agentName && (
        <div className={classNames('flex items-center gap-1 px-1.5 py-0.5 rounded text-xs', agentColor, 'bg-current/10')}>
          <div className={classNames(agentIcon, 'text-xs')} />
          <span className="capitalize">{log.agentName}</span>
        </div>
      )}

      {/* Message */}
      <span className="text-bolt-elements-textPrimary flex-1 break-words">
        {log.message}
      </span>

      {/* Task ID if present */}
      {log.taskId && (
        <span className="text-xs text-bolt-elements-textTertiary font-mono">
          #{log.taskId.slice(-6)}
        </span>
      )}
    </motion.div>
  );
});

LogItem.displayName = 'LogItem';

/**
 * Statistiques des agents
 */
const AgentStats = memo(() => {
  const stats = useStore(agentStatsStore);

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-bolt-elements-background-depth-3 border-b border-bolt-elements-borderColor text-xs">
      <div className="flex items-center gap-1">
        <div className="i-ph:robot text-bolt-elements-textSecondary" />
        <span className="text-bolt-elements-textSecondary">
          {stats.totalAgents} agents
        </span>
      </div>

      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-green-400">
          {stats.busyAgents} actif{stats.busyAgents > 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <div className="i-ph:check-circle text-bolt-elements-textSecondary" />
        <span className="text-bolt-elements-textSecondary">
          {stats.completedTasks} tâches
        </span>
      </div>

      {stats.failedTasks > 0 && (
        <div className="flex items-center gap-1">
          <div className="i-ph:x-circle text-red-400" />
          <span className="text-red-400">
            {stats.failedTasks} échec{stats.failedTasks > 1 ? 's' : ''}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1">
        <div className="i-ph:clock text-bolt-elements-textSecondary" />
        <span className="text-bolt-elements-textSecondary">
          {stats.pendingTasks} en attente
        </span>
      </div>
    </div>
  );
});

AgentStats.displayName = 'AgentStats';

/**
 * Filtres de logs
 */
const LogFilters = memo(({
  selectedLevel,
  selectedAgent,
  onLevelChange,
  onAgentChange,
}: {
  selectedLevel: LogLevel | 'all';
  selectedAgent: AgentType | 'all';
  onLevelChange: (level: LogLevel | 'all') => void;
  onAgentChange: (agent: AgentType | 'all') => void;
}) => {
  const levels: Array<LogLevel | 'all'> = ['all', 'debug', 'info', 'warn', 'error'];
  const agents: Array<AgentType | 'all'> = [
    'all',
    'orchestrator',
    'explore',
    'coder',
    'builder',
    'tester',
    'deployer',
    'reviewer',
    'fixer',
  ];

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-bolt-elements-borderColor">
      <span className="text-xs text-bolt-elements-textSecondary">Filtrer:</span>

      <select
        value={selectedLevel}
        onChange={e => onLevelChange(e.target.value as LogLevel | 'all')}
        className="text-xs bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded px-2 py-1 text-bolt-elements-textPrimary"
      >
        {levels.map(level => (
          <option key={level} value={level}>
            {level === 'all' ? 'Tous niveaux' : level}
          </option>
        ))}
      </select>

      <select
        value={selectedAgent}
        onChange={e => onAgentChange(e.target.value as AgentType | 'all')}
        className="text-xs bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded px-2 py-1 text-bolt-elements-textPrimary"
      >
        {agents.map(agent => (
          <option key={agent} value={agent}>
            {agent === 'all' ? 'Tous agents' : agent}
          </option>
        ))}
      </select>
    </div>
  );
});

LogFilters.displayName = 'LogFilters';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AgentActivityLog = memo(({
  isOpen,
  onClose,
  maxLogs = 100,
  autoScroll = true,
}: AgentActivityLogProps) => {
  const logs = useStore(systemLogsStore);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const [selectedLevel, setSelectedLevel] = React.useState<LogLevel | 'all'>('all');
  const [selectedAgent, setSelectedAgent] = React.useState<AgentType | 'all'>('all');

  // Filter logs
  const filteredLogs = React.useMemo(() => {
    let filtered = logs;

    if (selectedLevel !== 'all') {
      filtered = filtered.filter(log => log.level === selectedLevel);
    }

    if (selectedAgent !== 'all') {
      filtered = filtered.filter(log => log.agentName === selectedAgent);
    }

    return filtered.slice(-maxLogs);
  }, [logs, selectedLevel, selectedAgent, maxLogs]);

  const clearLogs = useCallback(() => {
    // Note: This would need to be implemented in the store
    // For now, just a placeholder
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 300 }}
          className="fixed right-0 top-0 bottom-0 w-96 bg-bolt-elements-background-depth-1 border-l border-bolt-elements-borderColor shadow-2xl z-40 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
            <div className="flex items-center gap-2">
              <div className="i-ph:list-bullets text-lg text-bolt-elements-textSecondary" />
              <h3 className="font-semibold text-bolt-elements-textPrimary">
                Activité des Agents
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-bolt-elements-background-depth-3 transition-colors"
            >
              <div className="i-ph:x text-bolt-elements-textSecondary" />
            </button>
          </div>

          {/* Stats */}
          <AgentStats />

          {/* Filters */}
          <LogFilters
            selectedLevel={selectedLevel}
            selectedAgent={selectedAgent}
            onLevelChange={setSelectedLevel}
            onAgentChange={setSelectedAgent}
          />

          {/* Logs list */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto divide-y divide-bolt-elements-borderColor/50"
          >
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-bolt-elements-textTertiary">
                <div className="i-ph:clipboard-text text-4xl mb-2" />
                <p className="text-sm">Aucune activité</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredLogs.map((log, index) => (
                  <LogItem key={`${log.timestamp.getTime()}-${index}`} log={log} />
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-xs">
            <span className="text-bolt-elements-textTertiary">
              {filteredLogs.length} entrée{filteredLogs.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={clearLogs}
              className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
            >
              Effacer
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// Import React for useState/useMemo
import React from 'react';

AgentActivityLog.displayName = 'AgentActivityLog';
