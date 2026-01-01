import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useAnimate } from 'framer-motion';
import { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ErrorBoundary } from '~/components/ui/ErrorBoundary';
import { AgentChatIntegration } from '~/components/agent';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { fileModificationsToHTML } from '~/utils/diff';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';
import { EditMessageModal } from './EditMessageModal';
import { multiAgentEnabledStore } from './MultiAgentToggle';
import { StreamingMessageParser } from '~/lib/runtime/message-parser';
import { updateAgentStatus } from '~/lib/stores/agents';

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

// Image compression settings
const MAX_IMAGE_DIMENSION = 1920; // Max width/height in pixels
const COMPRESSION_QUALITY = 0.8; // 0-1, only for JPEG/WebP

/**
 * Compresses an image file using canvas.
 * - Resizes if larger than MAX_IMAGE_DIMENSION
 * - Compresses JPEG/WebP to COMPRESSION_QUALITY
 * - Returns original file for GIFs (to preserve animation)
 */
const compressImage = async (file: File): Promise<File> => {
  // Don't compress GIFs (would break animation)
  if (file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
          width = MAX_IMAGE_DIMENSION;
        } else {
          width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
          height = MAX_IMAGE_DIMENSION;
        }
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file); // Fallback to original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob with compression
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = outputType === 'image/png' ? undefined : COMPRESSION_QUALITY;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // Only use compressed version if it's smaller
          if (blob.size < file.size) {
            const compressedFile = new File([blob], file.name, {
              type: outputType,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        outputType,
        quality,
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

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

  // Edit message state
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingMessageContent, setEditingMessageContent] = useState('');

  const { showChat, mode } = useStore(chatStore);
  const multiAgentEnabled = useStore(multiAgentEnabledStore);

  const [animationScope, animate] = useAnimate();

  // ============================================================================
  // ÉTAT PARTAGÉ UNIQUE - Messages unifiés pour les deux modes
  // ============================================================================
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageIdRef = useRef<string>('');

  // Message parser pour le streaming des artifacts
  const messageParser = useRef(new StreamingMessageParser({
    callbacks: {
      onArtifactOpen: (data) => {
        logger.info('Artifact opened:', data.id);
        workbenchStore.showWorkbench.set(true);
        workbenchStore.addArtifact(data);
      },
      onArtifactClose: (data) => {
        logger.info('Artifact closed:', data.id);
        workbenchStore.updateArtifact(data, { closed: true });
      },
      onActionOpen: (data) => {
        if (data.action.type !== 'shell') {
          workbenchStore.addAction(data);
        }
      },
      onActionClose: (data) => {
        if (data.action.type === 'shell') {
          workbenchStore.addAction(data);
        }
        workbenchStore.runAction(data);
      },
    },
  })).current;

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  // Stop/abort function
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStreamingContent('');
    if (multiAgentEnabled) {
      updateAgentStatus('orchestrator', 'idle');
    }
  }, [multiAgentEnabled]);

  // Get project files for context
  const getProjectFiles = useCallback(() => {
    const files: Array<{ path: string; content?: string }> = [];
    try {
      const workbenchFiles = workbenchStore.files.get();
      if (workbenchFiles && typeof workbenchFiles === 'object') {
        for (const [path, fileData] of Object.entries(workbenchFiles)) {
          if (fileData && typeof fileData === 'object' && 'content' in fileData) {
            files.push({
              path,
              content: (fileData as { content: string }).content,
            });
          }
        }
      }
    } catch (error) {
      logger.warn('Could not get files from workbench:', error);
    }
    return files;
  }, []);

  const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
  const { parsedMessages, parseMessages } = useMessageParser();

  // Memoize mapped messages to prevent re-renders
  const displayMessages = useMemo(() => {
    const mapped = messages.map((message, i) => {
      if (message.role === 'user') {
        return message;
      }
      return {
        ...message,
        content: parsedMessages[i] || '',
      };
    });

    // Add streaming message if active
    if (isLoading && streamingContent) {
      mapped.push({
        id: 'streaming',
        role: 'assistant' as const,
        content: streamingContent + (multiAgentEnabled && currentAgent ? `\n\n_[${currentAgent}]_` : ''),
      });
    }

    return mapped;
  }, [messages, parsedMessages, isLoading, streamingContent, multiAgentEnabled, currentAgent]);

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

  const abort = useCallback(() => {
    stop();
    chatStore.setKey('aborted', true);
    workbenchStore.abortAllActions();
  }, [stop]);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';

      const scrollHeight = textarea.scrollHeight;

      textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
      // Always use 'auto' to avoid scrollbar appearing/disappearing and shifting content
      textarea.style.overflowY = 'auto';
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

  // ============================================================================
  // ENVOI UNIFIÉ - Une seule fonction pour les deux modes
  // ============================================================================
  const sendMessage = useCallback(async (_event: React.UIEvent, messageInput?: string) => {
    const _input = messageInput || input;

    // allow sending if there's text OR files
    if ((_input.length === 0 && selectedFiles.length === 0) || isLoading) {
      return;
    }

    await workbenchStore.saveAllFiles();
    const fileModifications = workbenchStore.getFileModifications();

    chatStore.setKey('aborted', false);
    runAnimation();

    // build the message content
    let messageContent = _input;

    // Détecter les demandes de continuation
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

    // Add user message to the unified state
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageContent,
    };
    setMessages(prev => [...prev, userMessage]);

    // Handle file uploads (images)
    if (selectedFiles.length > 0) {
      try {
        const imageDataUrls = await Promise.all(selectedFiles.map((filePreview) => fileToDataURL(filePreview.file)));
        const contentParts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = [];

        imageDataUrls.forEach((dataUrl) => {
          contentParts.push({ type: 'image', image: dataUrl });
        });

        if (messageContent.length > 0) {
          contentParts.push({ type: 'text', text: messageContent });
        } else {
          contentParts.push({ type: 'text', text: 'Voici une image de référence pour mon projet.' });
        }

        // Update user message with multimodal content
        setMessages(prev => prev.map(m =>
          m.id === userMessage.id
            ? { ...m, content: contentParts as unknown as string }
            : m
        ));

        selectedFiles.forEach((filePreview) => {
          URL.revokeObjectURL(filePreview.preview);
        });
        setSelectedFiles([]);
      } catch (error) {
        logger.error('Error converting files to base64:', error);
        toast.error('Erreur lors du traitement des images');
        return;
      }
    }

    // Clear input
    setInput('');
    resetEnhancer();
    textareaRef.current?.blur();

    // ============================================================================
    // STREAMING - API différente selon le mode, mais même état de messages
    // ============================================================================
    setIsLoading(true);
    setStreamingContent('');
    messageIdRef.current = `stream-${Date.now()}`;
    abortControllerRef.current = new AbortController();

    const apiUrl = multiAgentEnabled ? '/api/agent' : '/api/chat';
    const messagesForApi = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));
    // Add the new user message
    messagesForApi.push({
      role: 'user',
      content: messageContent,
    });

    if (multiAgentEnabled) {
      updateAgentStatus('orchestrator', 'thinking');
      logger.info(`Sending to ${apiUrl} with ${messagesForApi.length} messages (multi-agent mode)`);
    } else {
      logger.info(`Sending to ${apiUrl} with ${messagesForApi.length} messages (normal mode)`);
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesForApi,
          files: getProjectFiles(),
          mode,
          context: { continuationContext },
          controlMode: 'strict',
          multiAgent: multiAgentEnabled,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let parsedContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          if (multiAgentEnabled) {
            // Parse agent response format (JSON lines)
            const lines = chunk.split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'text') {
                  fullContent += parsed.content;
                  const newParsed = messageParser.parse(messageIdRef.current, fullContent);
                  parsedContent += newParsed;
                  setStreamingContent(parsedContent);
                } else if (parsed.type === 'agent_status') {
                  setCurrentAgent(parsed.agent);
                  updateAgentStatus(parsed.agent, parsed.status);
                }
              } catch {
                fullContent += line;
                const newParsed = messageParser.parse(messageIdRef.current, fullContent);
                parsedContent += newParsed;
                setStreamingContent(parsedContent);
              }
            }
          } else {
            // Parse AI SDK format (0:"text"\n)
            const lines = chunk.split('\n').filter(Boolean);
            for (const line of lines) {
              const match = line.match(/^([0-9a-z]):(.+)$/i);
              if (match) {
                const [, type, data] = match;
                if (type === '0') {
                  try {
                    const content = JSON.parse(data);
                    fullContent += content;
                    const newParsed = messageParser.parse(messageIdRef.current, fullContent);
                    parsedContent += newParsed;
                    setStreamingContent(parsedContent);
                  } catch {
                    fullContent += data;
                    const newParsed = messageParser.parse(messageIdRef.current, fullContent);
                    parsedContent += newParsed;
                    setStreamingContent(parsedContent);
                  }
                }
              }
            }
          }
        }
      }

      // Add assistant message to unified state
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: fullContent,
      };
      setMessages(prev => [...prev, assistantMessage]);
      setStreamingContent('');

      // Store in history
      storeMessageHistory([...messages, userMessage, assistantMessage]).catch((error) =>
        toast.error(error.message)
      );

      if (multiAgentEnabled) {
        updateAgentStatus('orchestrator', 'idle');
      }

      setContinuationContext(null);
      logger.debug('Finished streaming');

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('Request aborted');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Request failed:', errorMessage);
        toast.error('Une erreur est survenue lors du traitement de votre demande');
      }
      if (multiAgentEnabled) {
        updateAgentStatus('orchestrator', 'idle');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, selectedFiles, messages, multiAgentEnabled, mode, getProjectFiles, storeMessageHistory, resetEnhancer]);

  const [messageRef, scrollRef] = useSnapScroll();

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files) {
      return;
    }

    // Process files in parallel with validation and compression
    const filePromises = Array.from(files).map(async (file): Promise<FilePreview | null> => {
      // validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast.error(`Type de fichier non supporté: ${file.name}. Utilisez JPEG, PNG, GIF ou WebP.`);
        return null;
      }

      // validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Fichier trop volumineux: ${file.name}. Maximum 5MB.`);
        return null;
      }

      try {
        // Compress image for better performance
        const compressedFile = await compressImage(file);

        // Create preview URL from compressed file
        const preview = URL.createObjectURL(compressedFile);

        return { file: compressedFile, preview };
      } catch {
        // Fallback to original on compression error
        const preview = URL.createObjectURL(file);
        return { file, preview };
      }
    });

    const results = await Promise.all(filePromises);
    const newFiles = results.filter((f): f is FilePreview => f !== null);

    if (newFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }

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

  // ============================================================================
  // MESSAGE EDITING - Edit and resend from a specific point
  // ============================================================================
  const handleEditMessage = useCallback((index: number) => {
    const message = messages[index];
    if (message && message.role === 'user') {
      const content = typeof message.content === 'string'
        ? message.content
        : '';
      setEditingMessageIndex(index);
      setEditingMessageContent(content);
    }
  }, [messages]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageIndex(null);
    setEditingMessageContent('');
  }, []);

  const handleSaveEdit = useCallback(async (index: number, newContent: string) => {
    // Close modal
    setEditingMessageIndex(null);
    setEditingMessageContent('');

    // Truncate messages up to and including the edited message
    // Then replace the user message with the new content and resend
    const truncatedMessages = messages.slice(0, index);
    setMessages(truncatedMessages);

    // Wait a tick for state to update
    await new Promise(resolve => setTimeout(resolve, 10));

    // Send the new message (this will add it to the messages array)
    const fakeEvent = {} as React.UIEvent;
    await sendMessage(fakeEvent, newContent);
  }, [messages, sendMessage]);

  const handleDeleteMessage = useCallback((index: number) => {
    // Delete message and all following messages
    const truncatedMessages = messages.slice(0, index);
    setMessages(truncatedMessages);
    storeMessageHistory(truncatedMessages).catch((error) => toast.error(error.message));
    toast.success('Message supprimé');
  }, [messages, storeMessageHistory]);

  const handleRegenerateMessage = useCallback(async (index: number) => {
    // Find the last user message before this assistant message
    let lastUserMessageIndex = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessageIndex = i;
        break;
      }
    }

    if (lastUserMessageIndex === -1) {
      toast.error('Impossible de régénérer: aucun message utilisateur trouvé');
      return;
    }

    // Get the user message content
    const userMessage = messages[lastUserMessageIndex];
    const content = typeof userMessage.content === 'string'
      ? userMessage.content
      : '';

    // Truncate to just before the assistant message
    const truncatedMessages = messages.slice(0, lastUserMessageIndex);
    setMessages(truncatedMessages);

    // Wait a tick for state to update
    await new Promise(resolve => setTimeout(resolve, 10));

    // Resend the user message
    const fakeEvent = {} as React.UIEvent;
    await sendMessage(fakeEvent, content);
  }, [messages, sendMessage]);

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
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
        onRegenerateMessage={handleRegenerateMessage}
        messages={displayMessages}
        enhancePrompt={() => {
          enhancePrompt(input, (input) => {
            setInput(input);
            scrollTextArea();
          });
        }}
      />

      {/* Edit Message Modal */}
      <EditMessageModal
        isOpen={editingMessageIndex !== null}
        initialContent={editingMessageContent}
        messageIndex={editingMessageIndex ?? 0}
        onSave={handleSaveEdit}
        onCancel={handleCancelEdit}
      />
    </>
  );
});
