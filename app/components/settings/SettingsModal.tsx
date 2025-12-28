import { memo } from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import * as RadixDialog from '@radix-ui/react-dialog';
import { settingsModalOpen, activeSettingsTab, closeSettingsModal } from '~/lib/stores/connectors';
import { classNames } from '~/utils/classNames';
import { dialogBackdropVariants, dialogVariants } from '~/components/ui/Dialog';
import { IconButton } from '~/components/ui/IconButton';
import { ConnectorsPanel } from './ConnectorsPanel';
import { GitHubPanel } from './GitHubPanel';

type SettingsTab = 'account' | 'connectors' | 'github';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: string;
}

const tabs: TabConfig[] = [
  { id: 'connectors', label: 'Connecteurs', icon: 'i-ph:plug' },
  { id: 'github', label: 'GitHub', icon: 'i-ph:github-logo' },
  { id: 'account', label: 'Compte', icon: 'i-ph:user' },
];

export const SettingsModal = memo(() => {
  const isOpen = useStore(settingsModalOpen);
  const currentTab = useStore(activeSettingsTab);

  const handleTabChange = (tab: SettingsTab) => {
    activeSettingsTab.set(tab);
  };

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={(open) => !open && closeSettingsModal()}>
      <AnimatePresence>
        {isOpen && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild>
              <motion.div
                className="bg-black/50 fixed inset-0 z-max"
                initial="closed"
                animate="open"
                exit="closed"
                variants={dialogBackdropVariants}
                onClick={closeSettingsModal}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild>
              <motion.div
                className="fixed top-[50%] left-[50%] z-max h-[85vh] w-[90vw] max-w-[900px] translate-x-[-50%] translate-y-[-50%] border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-2 shadow-lg focus:outline-none overflow-hidden flex"
                initial="closed"
                animate="open"
                exit="closed"
                variants={dialogVariants}
              >
                {/* Sidebar */}
                <div className="w-56 flex-shrink-0 border-r border-bolt-elements-borderColor bg-bolt-elements-background-depth-3 p-4">
                  <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">Paramètres</h2>

                  <nav className="space-y-1" role="tablist" aria-label="Onglets des paramètres">
                    {tabs.map((tab) => {
                      const isActive = currentTab === tab.id;
                      const tabId = `settings-tab-${tab.id}`;
                      const panelId = `settings-panel-${tab.id}`;

                      return (
                        <button
                          key={tab.id}
                          id={tabId}
                          role="tab"
                          aria-selected={isActive}
                          aria-controls={panelId}
                          tabIndex={isActive ? 0 : -1}
                          onClick={() => handleTabChange(tab.id)}
                          className={classNames(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-theme',
                            isActive
                              ? 'bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText'
                              : 'bg-bolt-elements-sidebar-buttonBackgroundDefault/50 text-bolt-elements-sidebar-buttonText/70 hover:bg-bolt-elements-sidebar-buttonBackgroundHover hover:text-bolt-elements-sidebar-buttonText',
                          )}
                        >
                          <span className={classNames(tab.icon, 'text-lg')} aria-hidden="true" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Content */}
                <div
                  id={`settings-panel-${currentTab}`}
                  role="tabpanel"
                  aria-labelledby={`settings-tab-${currentTab}`}
                  className="flex-1 overflow-y-auto p-6"
                >
                  {currentTab === 'connectors' && <ConnectorsPanel />}
                  {currentTab === 'github' && <GitHubPanel />}
                  {currentTab === 'account' && <AccountPanel />}
                </div>

                {/* Close button */}
                <RadixDialog.Close asChild onClick={closeSettingsModal}>
                  <IconButton icon="i-ph:x" className="absolute top-4 right-4" title="Fermer les paramètres" />
                </RadixDialog.Close>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
});

// Placeholder for account panel
const AccountPanel = memo(() => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Compte</h2>
        <p className="text-sm text-bolt-elements-textSecondary mt-1">Gérez les paramètres de votre compte</p>
      </div>

      <div className="p-8 text-center text-bolt-elements-textTertiary border border-dashed border-bolt-elements-borderColor rounded-lg">
        <span className="i-ph:user-circle text-4xl mb-2 block" />
        <p>Fonctionnalité bientôt disponible</p>
      </div>
    </div>
  );
});
