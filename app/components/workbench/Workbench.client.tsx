import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror';
import { ErrorBoundary, MinimalErrorFallback } from '~/components/ui/ErrorBoundary';
import { IconButton } from '~/components/ui/IconButton';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { Slider, type SliderOptions } from '~/components/ui/Slider';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { chatId } from '~/lib/persistence/useChatHistory';
import { useCheckpoints } from '~/lib/hooks/useCheckpoints';
import { useAutoCheckpoint } from '~/lib/hooks/useAutoCheckpoint';
import type { FileMap } from '~/lib/stores/files';
import type { RestoreOptions } from '~/types/checkpoint';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';
import { CheckpointButton } from './CheckpointButton';
import { CheckpointTimeline, type TimelineCheckpoint } from './CheckpointTimeline';
import { RestoreModal, type RestoreModalCheckpoint } from './RestoreModal';

const logger = createScopedLogger('Workbench');

interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
}

const viewTransition = { ease: cubicEasingFn };

const sliderOptions: SliderOptions<WorkbenchViewType> = {
  left: {
    value: 'code',
    text: 'Code',
  },
  right: {
    value: 'preview',
    text: 'Aperçu',
  },
};

const workbenchVariants = {
  closed: {
    opacity: 0,
    pointerEvents: 'none' as const,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    pointerEvents: 'auto' as const,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

export const Workbench = memo(({ chatStarted, isStreaming }: WorkspaceProps) => {
  renderLogger.trace('Workbench');

  const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const selectedFile = useStore(workbenchStore.selectedFile);
  
  // Debug logging
  useEffect(() => {
    logger.debug('Workbench state changed', { showWorkbench, chatStarted });
    console.log('%c[WORKBENCH RENDER] State changed:', 'background: #9C27B0; color: white; font-size: 14px; padding: 4px 8px;', { showWorkbench, chatStarted, hasPreview });
    if (showWorkbench) {
      console.log('%c[WORKBENCH RENDER] ✅ Workbench should be VISIBLE now!', 'background: #4CAF50; color: white; font-size: 16px; font-weight: bold; padding: 8px;');
    }
  }, [showWorkbench, chatStarted, hasPreview]);
  const currentDocument = useStore(workbenchStore.currentDocument);
  const unsavedFiles = useStore(workbenchStore.unsavedFiles);
  const files = useStore(workbenchStore.files);
  const selectedView = useStore(workbenchStore.currentView);
  const currentChatId = useStore(chatId);

  // Checkpoint state
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<RestoreModalCheckpoint | null>(null);
  const [showCheckpointTimeline, setShowCheckpointTimeline] = useState(false);

  // Checkpoint callbacks
  const getFilesSnapshot = useCallback((): FileMap => {
    return workbenchStore.files.get();
  }, []);

  const getMessages = useCallback(() => {
    return [];
  }, []);

  const onRestoreFiles = useCallback(async (restoredFiles: FileMap): Promise<void> => {
    // Restore files with WebContainer synchronization
    const result = await workbenchStore.restoreFromSnapshot(restoredFiles);
    logger.info(`Restored ${result.filesWritten} files, deleted ${result.filesDeleted} files`);
  }, []);

  // Initialize checkpoints hook
  const {
    checkpoints,
    checkpointCount,
    isRestoring,
    isLoading: isCheckpointLoading,
    currentCheckpointId,
    createCheckpoint,
    restoreCheckpoint,
    deleteCheckpoint,
    formatForTimeline,
  } = useCheckpoints({
    chatId: currentChatId ?? '',
    getFilesSnapshot,
    getMessages,
    onRestoreFiles,
    autoLoad: true,
  });

  // Auto-checkpoint on significant file changes
  const handleAutoCheckpoint = useCallback(async (description: string) => {
    if (!currentChatId) return;
    try {
      await createCheckpoint(description, 'auto');
      logger.debug('Auto-checkpoint created');
    } catch (error) {
      logger.error('Failed to create auto-checkpoint:', error);
    }
  }, [currentChatId, createCheckpoint]);

  // Initialize auto-checkpoint hook
  const { resetBaseline } = useAutoCheckpoint({
    onCreateCheckpoint: handleAutoCheckpoint,
    enabled: !!currentChatId && !isStreaming,
    minChangedFiles: 3,
    minChangedBytes: 1024,
    debounceMs: 10000, // 10 seconds after last change
  });

  // Reset baseline after manual checkpoint
  const handleCreateCheckpoint = useCallback(async () => {
    if (!currentChatId) {
      toast.error('Aucune conversation active');
      return;
    }
    try {
      const checkpoint = await createCheckpoint('Point de sauvegarde manuel', 'manual');
      if (checkpoint) {
        toast.success('Checkpoint créé');
        resetBaseline(); // Reset auto-checkpoint baseline
      }
    } catch {
      toast.error('Erreur lors de la création');
    }
  }, [currentChatId, createCheckpoint, resetBaseline]);

  const handleSelectCheckpoint = useCallback(
    (checkpointId: string) => {
      const checkpoint = checkpoints.find((cp) => cp.id === checkpointId);
      if (!checkpoint) return;

      const timeline = formatForTimeline(checkpoint);
      setSelectedCheckpoint({
        id: checkpoint.id,
        description: timeline.description,
        time: timeline.time,
        timeAgo: timeline.timeAgo,
        type: timeline.type,
        filesCount: Object.keys(checkpoint.filesSnapshot).length,
        messagesCount: checkpoint.messagesSnapshot.length,
        sizeLabel: timeline.sizeLabel,
      });
      setIsRestoreModalOpen(true);
    },
    [checkpoints, formatForTimeline],
  );

  const handleConfirmRestore = useCallback(
    async (options: RestoreOptions) => {
      if (!selectedCheckpoint) return;
      try {
        const result = await restoreCheckpoint(selectedCheckpoint.id, options);
        if (result.success) {
          toast.success(`Restauré: ${result.filesRestored} fichiers`);
          setIsRestoreModalOpen(false);
          setSelectedCheckpoint(null);
        } else {
          toast.error(`Échec: ${result.error}`);
        }
      } catch {
        toast.error('Erreur lors de la restauration');
      }
    },
    [selectedCheckpoint, restoreCheckpoint],
  );

  const handleDeleteCheckpoint = useCallback(
    async (checkpointId: string) => {
      try {
        const deleted = await deleteCheckpoint(checkpointId);
        if (deleted) {
          toast.success('Checkpoint supprimé');
        }
      } catch {
        toast.error('Erreur lors de la suppression');
      }
    },
    [deleteCheckpoint],
  );

  const timelineCheckpoints: TimelineCheckpoint[] = checkpoints.map((cp) => formatForTimeline(cp));

  const setSelectedView = useCallback((view: WorkbenchViewType) => {
    workbenchStore.currentView.set(view);
  }, []);

  useEffect(() => {
    if (hasPreview) {
      setSelectedView('preview');
    }
  }, [hasPreview, setSelectedView]);

  useEffect(() => {
    workbenchStore.setDocuments(files);
  }, [files]);

  const onEditorChange = useCallback<OnEditorChange>((update) => {
    workbenchStore.setCurrentDocumentContent(update.content);
  }, []);

  const onEditorScroll = useCallback<OnEditorScroll>((position) => {
    workbenchStore.setCurrentDocumentScrollPosition(position);
  }, []);

  const onFileSelect = useCallback((filePath: string | undefined) => {
    workbenchStore.setSelectedFile(filePath);
  }, []);

  const onFileSave = useCallback(() => {
    workbenchStore.saveCurrentDocument().catch(() => {
      toast.error('Échec de la mise à jour du fichier');
    });
  }, []);

  const onFileReset = useCallback(() => {
    workbenchStore.resetCurrentDocument();
  }, []);

  // Always render workbench component to avoid re-mount issues
  // The visibility is controlled by motion.div animation (open/closed variants)
  
  // Debug: log showWorkbench value
  logger.debug('Rendering Workbench', { showWorkbench, chatStarted, hasPreview });
  
  return (
    <>
      <div
        className="z-workbench flex-shrink-0 h-full overflow-hidden transition-all duration-300"
        style={{
          width: chatStarted && showWorkbench ? 'min(55vw, calc(100vw - 450px))' : 0,
          minWidth: chatStarted && showWorkbench ? '350px' : 0,
          maxWidth: chatStarted && showWorkbench ? '900px' : 0,
          opacity: chatStarted && showWorkbench ? 1 : 0,
        }}
      >
          <div className="h-full w-full py-4 pr-4">
            <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor shadow-sm rounded-lg overflow-hidden">
              <div className="flex items-center px-3 py-2 border-b border-bolt-elements-borderColor">
                <Slider selected={selectedView} options={sliderOptions} setSelected={setSelectedView} />
                <div className="ml-auto" />
                {selectedView === 'code' && (
                  <>
                    {currentChatId && (
                      <div className="relative">
                        <CheckpointButton
                          onCreateCheckpoint={handleCreateCheckpoint}
                          disabled={isRestoring}
                          isLoading={isCheckpointLoading}
                          checkpointCount={checkpointCount}
                          className="mr-1 text-sm"
                        />
                        {showCheckpointTimeline && checkpointCount > 0 && (
                          <div className="absolute top-full right-0 mt-1 w-72 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg shadow-lg z-50 overflow-hidden">
                            <div className="max-h-80 overflow-y-auto p-2">
                              <CheckpointTimeline
                                checkpoints={timelineCheckpoints}
                                currentCheckpointId={currentCheckpointId}
                                onSelectCheckpoint={handleSelectCheckpoint}
                                onDeleteCheckpoint={handleDeleteCheckpoint}
                                disabled={isRestoring}
                                isLoading={isCheckpointLoading}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {checkpointCount > 0 && (
                      <PanelHeaderButton
                        className="mr-1 text-sm"
                        onClick={() => setShowCheckpointTimeline(!showCheckpointTimeline)}
                      >
                        <div className="i-ph:clock-counter-clockwise" />
                        Historique
                        <span className="text-xs opacity-60">({checkpointCount})</span>
                      </PanelHeaderButton>
                    )}
                    <PanelHeaderButton
                      className="mr-1 text-sm"
                      onClick={() => {
                        workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get());
                      }}
                    >
                      <div className="i-ph:terminal" />
                      Terminal
                    </PanelHeaderButton>
                  </>
                )}
                <IconButton
                  icon="i-ph:x-circle"
                  className="-mr-1"
                  size="xl"
                  title="Fermer le code"
                  onClick={() => {
                    workbenchStore.showWorkbench.set(false);
                  }}
                />
              </div>
              <div className="relative flex-1 overflow-hidden">
                <View
                  initial={{ x: selectedView === 'code' ? 0 : '-100%' }}
                  animate={{ x: selectedView === 'code' ? 0 : '-100%' }}
                >
                  <ErrorBoundary
                    fallback={<MinimalErrorFallback />}
                    onError={(error) => {
                      logger.error('Editor panel error:', error);
                    }}
                  >
                    <EditorPanel
                      editorDocument={currentDocument}
                      isStreaming={isStreaming}
                      selectedFile={selectedFile}
                      files={files}
                      unsavedFiles={unsavedFiles}
                      onFileSelect={onFileSelect}
                      onEditorScroll={onEditorScroll}
                      onEditorChange={onEditorChange}
                      onFileSave={onFileSave}
                      onFileReset={onFileReset}
                    />
                  </ErrorBoundary>
                </View>
                <View
                  initial={{ x: selectedView === 'preview' ? 0 : '100%' }}
                  animate={{ x: selectedView === 'preview' ? 0 : '100%' }}
                >
                  <ErrorBoundary
                    fallback={<MinimalErrorFallback />}
                    onError={(error) => {
                      logger.error('Preview error:', error);
                    }}
                  >
                    <Preview />
                  </ErrorBoundary>
                </View>
              </div>
            </div>
          </div>
        </div>

      {/* Restore Modal */}
      <RestoreModal
        isOpen={isRestoreModalOpen}
        checkpoint={selectedCheckpoint}
        onConfirm={handleConfirmRestore}
        onCancel={() => {
          setIsRestoreModalOpen(false);
          setSelectedCheckpoint(null);
        }}
        isLoading={isRestoring}
      />
    </>
  );
});

interface ViewProps extends HTMLMotionProps<'div'> {
  children: JSX.Element;
}

const View = memo(({ children, ...props }: ViewProps) => {
  return (
    <motion.div className="absolute inset-0" transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
