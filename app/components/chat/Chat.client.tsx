import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from 'ai/react';
import { useAnimate } from 'framer-motion';
import { memo, useEffect, useRef, useState } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { ErrorBoundary } from '~/components/ui/ErrorBoundary';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { fileModificationsToHTML } from '~/utils/diff';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory } = useChatHistory();

  return (
    <>
      <ErrorBoundary
        onError={(error) => {
          logger.error('Chat error boundary caught error:', error);
        }}
      >
        {/* Always render ChatImpl - it handles its own loading state */}
        <ChatImpl
          initialMessages={initialMessages}
          storeMessageHistory={storeMessageHistory}
          isLoadingHistory={!ready}
        />
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
    </>
  );
}

interface ChatProps {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
  isLoadingHistory?: boolean;
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

export const ChatImpl = memo(({ initialMessages, storeMessageHistory, isLoadingHistory = false }: ChatProps) => {
  useShortcuts();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
  const [selectedFiles, setSelectedFiles] = useState<FilePreview[]>([]);

  const { showChat, mode } = useStore(chatStore);

  const [animationScope, animate] = useAnimate();

  const { messages, isLoading, input, handleInputChange, setInput, stop, append } = useChat({
    api: '/api/chat',
    body: {
      mode,
    },
    onError: (error) => {
      logger.error('Request failed\n\n', error);
      toast.error('Une erreur est survenue lors du traitement de votre demande');
    },
    onFinish: () => {
      logger.debug('Finished streaming');
    },
    initialMessages,
  });

  const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
  const { parsedMessages, parseMessages } = useMessageParser();

  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

  // Update chatStarted when initialMessages changes (e.g., after loading from DB)
  useEffect(() => {
    if (initialMessages.length > 0 && !chatStarted) {
      setChatStarted(true);
    }

    chatStore.setKey('started', initialMessages.length > 0);
  }, [initialMessages]);

  useEffect(() => {
    parseMessages(messages, isLoading);

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  }, [messages, isLoading, parseMessages]);

  const scrollTextArea = () => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  };

  const abort = () => {
    stop();
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
      animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
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

    const fileModifications = workbenchStore.getFileModifcations();

    chatStore.setKey('aborted', false);

    runAnimation();

    // build the message content
    let messageContent = _input;

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
      append({ role: 'user', content: messageContent });
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

  // cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      selectedFiles.forEach((filePreview) => {
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
        isLoadingHistory={isLoadingHistory}
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
        messages={messages.map((message, i) => {
          if (message.role === 'user') {
            return message;
          }

          return {
            ...message,
            content: parsedMessages[i] || '',
          };
        })}
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
