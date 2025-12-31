import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from 'ai/react';
import { useAnimate } from 'framer-motion';
import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ErrorBoundary } from '~/components/ui/ErrorBoundary';
import { AgentChatIntegration } from '~/components/agent';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll, useAgentChat } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { fileModificationsToHTML } from '~/utils/diff';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';
import { multiAgentEnabledStore } from './MultiAgentToggle';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

// Mots-clés indiquant une demande de continuation
const CONTINUE_KEYWORDS = [
  'continue',
  'continuer',
  'continues',
  'poursuit',
  'poursuis',
  'reprend',
  'reprends',
  'finis',
  'termine',
  'complete',
  'go on',
  'keep going',
];

/**
 * Vérifie si le message est une demande de continuation
 */
function isContinuationRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  return CONTINUE_KEYWORDS.some((keyword) => {
    // Match le mot-clé seul ou au début/fin du message
    const regex = new RegExp(`(^|\\s)${keyword}($|\\s|\\.|!|\\?)`, 'i');
    return regex.test(lowerMessage) || lowerMessage === keyword;
  });
}

/**
 * Vérifie si le dernier message assistant semble incomplet (artifact non fermé)
 */
function isLastResponseIncomplete(messages: Message[]): { incomplete: boolean; lastContent: string } {
  // Trouver le dernier message assistant
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant' && msg.content) {
      const content = msg.content;

      // Vérifier si l'artifact est ouvert mais pas fermé
      const hasOpenArtifact = content.includes('<boltArtifact');
      const hasCloseArtifact = content.includes('</boltArtifact>');

      // Vérifier si une action est ouverte mais pas fermée
      const hasOpenAction = content.includes('<boltAction');
      const lastOpenAction = content.lastIndexOf('<boltAction');
      const lastCloseAction = content.lastIndexOf('</boltAction>');

      const incomplete = (hasOpenArtifact && !hasCloseArtifact) ||
                        (hasOpenAction && lastOpenAction > lastCloseAction);

      return { incomplete, lastContent: content };
    }
  }
  return { incomplete: false, lastContent: '' };
}

/**
 * Extrait le contexte de continuation (ID artifact, etc.)
 */
function getContinuationContext(lastContent: string): { artifactId: string | null } {
  const artifactIdMatch = lastContent.match(/<boltArtifact[^>]*id="([^"]+)"/);
  return { artifactId: artifactIdMatch ? artifactIdMatch[1] : null };
}

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory } = useChatHistory();
  const showWorkbench = useStore(workbenchStore.showWorkbench);

  return (
    <>
      <ErrorBoundary
        onError={(error) => {
          logger.error('Chat error boundary caught error:', error);
        }}
      >
        {/* Only render ChatImpl when ready - like Bolt.new
          * This prevents the flash to welcome screen when loading a chat from URL.
          * Before ready, initialMessages is empty which causes chatStarted=false,
          * briefly showing the welcome screen before the useEffect corrects it.
          */}
        {ready ? (
          <ChatImpl
            initialMessages={initialMessages}
            storeMessageHistory={storeMessageHistory}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-bolt-elements-background-depth-1">
            <div className="flex flex-col items-center gap-3">
              <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-3xl" />
              <span className="text-bolt-elements-textSecondary text-sm">
                Chargement...
              </span>
            </div>
          </div>
        )}
      </ErrorBoundary>
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          /**
           * @todo Handle more types if we need them. This may require extra color palettes.
           */
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
      />
      {/* Agent system integration - only show when project is active */}
      {showWorkbench && (
        <AgentChatIntegration
          showStatusBadge={true}
          showActivityLog={true}
          position="bottom-right"
        />
      )}
    </>
  );
}

interface ChatProps {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
}

interface FilePreview {
  file: File;
  preview: string;
}

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// converts file to base64 data URL
const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const ChatImpl = memo(({ initialMessages, storeMessageHistory }: ChatProps) => {
  useShortcuts();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFilesRef = useRef<FilePreview[]>([]);

  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
  const [selectedFiles, setSelectedFiles] = useState<FilePreview[]>([]);
  const [continuationContext, setContinuationContext] = useState<{ artifactId: string | null } | null>(null);

  const { showChat, mode } = useStore(chatStore);
  const multiAgentEnabled = useStore(multiAgentEnabledStore);

  const [animationScope, animate] = useAnimate();

  // State for managing messages when using agent mode
  const [agentMessages, setAgentMessages] = useState<Message[]>(initialMessages);
  const [agentStreaming, setAgentStreaming] = useState('');

  const { messages: chatMessages, isLoading: chatLoading, input, handleInputChange, setInput, stop, append } = useChat({
    api: '/api/chat',
    body: {
      mode,
      continuationContext,
      multiAgent: false, // Standard mode always uses /api/chat without multi-agent flag
    },
    onError: (error) => {
      logger.error('Request failed\n\n', error);
      toast.error('Une erreur est survenue lors du traitement de votre demande');
    },
    onFinish: () => {
      logger.debug('Finished streaming');
      setContinuationContext(null);
    },
    initialMessages,
  });

  // Agent chat hook for multi-agent mode
  const {
    sendMessage: sendAgentMessage,
    streamingContent,
    isProcessing: agentProcessing,
    currentAgent,
    abort: abortAgent,
  } = useAgentChat({
    onStart: () => {
      logger.info('Multi-agent processing started');
    },
    onFinish: (result) => {
      logger.info('Multi-agent processing finished', { success: result.success });
      if (result.success && result.content) {
        // Add the agent response to messages
        const assistantMessage: Message = {
          id: `agent-${Date.now()}`,
          role: 'assistant',
          content: result.content,
        };
        setAgentMessages(prev => [...prev, assistantMessage]);
        setAgentStreaming('');

        // Store in history
        storeMessageHistory([...agentMessages, assistantMessage]).catch((error) =>
          toast.error(error.message)
        );
      }
    },
    onError: (error) => {
      logger.error('Multi-agent error:', error);
      toast.error('Erreur du système multi-agent: ' + error.message);
    },
    onStream: (text) => {
      setAgentStreaming(text);
    },
  });

  // Use the appropriate messages and loading state based on mode
  const messages = multiAgentEnabled ? agentMessages : chatMessages;
  const isLoading = multiAgentEnabled ? agentProcessing : chatLoading;

  const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
  const { parsedMessages, parseMessages } = useMessageParser();

  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

  // Sync chatStore on mount - like Bolt.new
  // Since we only render when ready=true, initialMessages is already populated at mount
  useEffect(() => {
    chatStore.setKey('started', initialMessages.length > 0);
  }, []);

  useEffect(() => {
    parseMessages(messages, isLoading);

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  }, [messages, isLoading, parseMessages, initialMessages.length, storeMessageHistory]);

  const scrollTextArea = () => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  };

  const abort = () => {
    if (multiAgentEnabled) {
      abortAgent();
    } else {
      stop();
    }
    chatStore.setKey('aborted', true);
    workbenchStore.abortAllActions();
  };

  useEffect(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';

      const scrollHeight = textarea.scrollHeight;

      textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
      textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
    }
  }, [input, textareaRef]);

  const runAnimation = async () => {
    if (chatStarted) {
      return;
    }

    await Promise.all([
      animate('#categories', { opacity: 0, display: 'none' }, { duration: 0.1 }),
      animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
    ]);

    chatStore.setKey('started', true);

    setChatStarted(true);
  };

  const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
    const _input = messageInput || input;

    // allow sending if there's text OR files
    if ((_input.length === 0 && selectedFiles.length === 0) || isLoading) {
      return;
    }

    /**
     * @note (delm) Usually saving files shouldn't take long but it may take longer if there
     * many unsaved files. In that case we need to block user input and show an indicator
     * of some kind so the user is aware that something is happening. But I consider the
     * happy case to be no unsaved files and I would expect users to save their changes
     * before they send another message.
     */
    await workbenchStore.saveAllFiles();

    const fileModifications = workbenchStore.getFileModifications();

    chatStore.setKey('aborted', false);

    runAnimation();

    // build the message content
    let messageContent = _input;

    // Détecter les demandes de continuation et définir le contexte (sans modifier le message affiché)
    if (isContinuationRequest(_input)) {
      const { incomplete, lastContent } = isLastResponseIncomplete(messages);
      if (incomplete || lastContent) {
        logger.debug('Continuation request detected, setting context');
        const context = getContinuationContext(lastContent);
        setContinuationContext(context);
      }
    }

    // if there are file modifications, prefix them
    if (fileModifications !== undefined) {
      const diff = fileModificationsToHTML(fileModifications);
      messageContent = `${diff}\n\n${_input}`;
      workbenchStore.resetAllFileModifications();
    }

    // if there are selected files, convert them and create multimodal message
    if (selectedFiles.length > 0) {
      try {
        // convert all files to base64 data URLs
        const imageDataUrls = await Promise.all(selectedFiles.map((filePreview) => fileToDataURL(filePreview.file)));

        // create multimodal content array
        const contentParts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = [];

        // add images first
        imageDataUrls.forEach((dataUrl) => {
          contentParts.push({ type: 'image', image: dataUrl });
        });

        // add text if present
        if (messageContent.length > 0) {
          contentParts.push({ type: 'text', text: messageContent });
        } else {
          // if no text, add a default message
          contentParts.push({ type: 'text', text: 'Voici une image de référence pour mon projet.' });
        }

        // send multimodal message
        append({
          role: 'user',
          content: contentParts as unknown as string, // type cast needed for AI SDK compatibility
        });

        // clear selected files and revoke URLs
        selectedFiles.forEach((filePreview) => {
          URL.revokeObjectURL(filePreview.preview);
        });
        setSelectedFiles([]);
      } catch (error) {
        logger.error('Error converting files to base64:', error);
        toast.error('Erreur lors du traitement des images');

        return;
      }
    } else {
      // no files, send text-only message
      if (multiAgentEnabled) {
        // Add user message to agent messages first
        const userMessage: Message = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: messageContent,
        };
        setAgentMessages(prev => [...prev, userMessage]);

        // Send via multi-agent system
        logger.info('Sending message via multi-agent system');
        sendAgentMessage(messageContent, {
          mode,
          continuationContext,
        });
      } else {
        // Standard mode - use useChat's append
        append({ role: 'user', content: messageContent });
      }
    }

    setInput('');

    resetEnhancer();

    textareaRef.current?.blur();
  };

  const [messageRef, scrollRef] = useSnapScroll();

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files) {
      return;
    }

    const newFiles: FilePreview[] = [];

    Array.from(files).forEach((file) => {
      // validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast.error(`Type de fichier non supporté: ${file.name}. Utilisez JPEG, PNG, GIF ou WebP.`);
        return;
      }

      // validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Fichier trop volumineux: ${file.name}. Maximum 5MB.`);
        return;
      }

      // create preview URL
      const preview = URL.createObjectURL(file);
      newFiles.push({ file, preview });
    });

    setSelectedFiles((prev) => [...prev, ...newFiles]);

    // reset input so same file can be selected again
    event.target.value = '';
  };

  const handleFileRemove = (index: number) => {
    setSelectedFiles((prev) => {
      const newFiles = [...prev];

      // revoke the object URL to free memory
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);

      return newFiles;
    });
  };

  // Keep ref in sync with state for cleanup
  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  // cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      selectedFilesRef.current.forEach((filePreview) => {
        URL.revokeObjectURL(filePreview.preview);
      });
    };
  }, []);

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        aria-label="Sélectionner des images à joindre"
        onChange={handleFileChange}
      />
      <BaseChat
        ref={animationScope}
        textareaRef={textareaRef}
        fileInputRef={fileInputRef}
        input={input}
        showChat={showChat}
        chatStarted={chatStarted}
        isStreaming={isLoading}
        enhancingPrompt={enhancingPrompt}
        promptEnhanced={promptEnhanced}
        selectedFiles={selectedFiles}
        sendMessage={sendMessage}
        messageRef={messageRef}
        scrollRef={scrollRef}
        handleInputChange={handleInputChange}
        handleStop={abort}
        onFileSelect={handleFileSelect}
        onFileRemove={handleFileRemove}
        messages={(() => {
          // Map existing messages
          const mappedMessages = messages.map((message, i) => {
            if (message.role === 'user') {
              return message;
            }

            return {
              ...message,
              content: parsedMessages[i] || '',
            };
          });

          // If multi-agent is streaming, add streaming message
          if (multiAgentEnabled && agentStreaming && agentProcessing) {
            mappedMessages.push({
              id: 'streaming',
              role: 'assistant' as const,
              content: agentStreaming + (currentAgent ? `\n\n_[${currentAgent}]_` : ''),
            });
          }

          return mappedMessages;
        })()}
        enhancePrompt={() => {
          enhancePrompt(input, (input) => {
            setInput(input);
            scrollTextArea();
          });
        }}
      />
    </>
  );
});
