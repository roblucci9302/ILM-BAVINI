/**
 * MultiAgentToggle - Toggle pour activer/désactiver le système multi-agent
 *
 * - Standard: LLM direct (comportement par défaut)
 * - Multi-Agent: Orchestrateur + sous-agents avec approbation
 *
 * Persiste le choix dans localStorage
 */

import { memo, useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { IconButton } from '~/components/ui/IconButton';
import { activeAgentCountStore } from '~/lib/stores/agents';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'bavini-multi-agent-enabled';

// ============================================================================
// STORE
// ============================================================================

import { atom } from 'nanostores';

/**
 * Store pour l'état du mode multi-agent
 */
export const multiAgentEnabledStore = atom<boolean>(false);

/**
 * Initialiser depuis localStorage (côté client uniquement)
 */
export function initMultiAgentFromStorage(): void {
  if (typeof window === 'undefined') return;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    multiAgentEnabledStore.set(stored === 'true');
  }
}

/**
 * Activer/désactiver le mode multi-agent
 */
export function setMultiAgentEnabled(enabled: boolean): void {
  multiAgentEnabledStore.set(enabled);

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }
}

/**
 * Toggle le mode multi-agent
 */
export function toggleMultiAgent(): void {
  const current = multiAgentEnabledStore.get();
  setMultiAgentEnabled(!current);
}

// ============================================================================
// COMPONENT
// ============================================================================

interface MultiAgentToggleProps {
  className?: string;
}

export const MultiAgentToggle = memo(({ className }: MultiAgentToggleProps) => {
  const isEnabled = useStore(multiAgentEnabledStore);
  const activeCount = useStore(activeAgentCountStore);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    initMultiAgentFromStorage();
    setIsInitialized(true);
  }, []);

  // Don't render until initialized to avoid hydration mismatch
  if (!isInitialized) {
    return null;
  }

  return (
    <IconButton
      title={isEnabled ? 'Multi-Agent activé - Cliquez pour désactiver' : 'Multi-Agent désactivé - Cliquez pour activer'}
      className={classNames(
        'relative',
        { 'text-bolt-elements-item-contentAccent': isEnabled },
        className
      )}
      onClick={() => toggleMultiAgent()}
    >
      <div className="relative">
        <div className={classNames('text-xl', isEnabled ? 'i-ph:robot-fill' : 'i-ph:robot')} />

        {/* Indicateur actif - dot vert */}
        {isEnabled && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-bolt-elements-background-depth-1" />
        )}
      </div>

      {/* Badge count si agents actifs */}
      <AnimatePresence>
        {isEnabled && activeCount > 0 && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -bottom-1 -right-1 min-w-4 h-4 px-1 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
          >
            {activeCount}
          </motion.span>
        )}
      </AnimatePresence>
    </IconButton>
  );
});

MultiAgentToggle.displayName = 'MultiAgentToggle';

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook pour utiliser l'état multi-agent
 */
export function useMultiAgent() {
  const isEnabled = useStore(multiAgentEnabledStore);
  const activeCount = useStore(activeAgentCountStore);

  return {
    isEnabled,
    activeCount,
    setEnabled: setMultiAgentEnabled,
    toggle: toggleMultiAgent,
  };
}
