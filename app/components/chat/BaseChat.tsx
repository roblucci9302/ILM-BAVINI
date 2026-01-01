import type { Message } from 'ai';
import { useStore } from '@nanostores/react';
import React, { type RefCallback, useRef, useCallback, useState, useEffect, memo } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { LazyColorBendsWrapper as ColorBends } from '~/components/ui/ColorBends.lazy';
import { Menu } from '~/components/sidebar/Menu.client';
import { IconButton } from '~/components/ui/IconButton';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { chatStore, setChatMode } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { preloadOnTypingStart, preloadOnFirstMessage, preloadOnWorkbenchInteraction } from '~/lib/performance';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';
import { Messages } from './Messages.client';
import { MultiAgentToggle } from './MultiAgentToggle';
import { SendButton } from './SendButton.client';
import { TemplatePills } from './TemplatePills';

import styles from './BaseChat.module.scss';

/**
 * Bouton toggle pour activer/désactiver le mode Chat
 * - Mode Chat actif: icône remplie + dot vert (analyse seule)
 * - Mode Agent actif: icône outline (BAVINI peut coder)
 */
const ChatModeToggle = memo(() => {
  const { mode } = useStore(chatStore);
  const isChatMode = mode === 'chat';

  const handleToggle = useCallback(() => {
    // toggle entre 'chat' et 'agent'
    setChatMode(isChatMode ? 'agent' : 'chat');
  }, [isChatMode]);

  return (
    <IconButton
      title={
        isChatMode
          ? 'Mode Chat actif - Cliquez pour passer en mode Agent'
          : 'Mode Agent actif - Cliquez pour passer en mode Chat'
      }
      className={classNames(
        'relative transition-colors',
        isChatMode
          ? 'text-bolt-elements-item-contentAccent'
          : 'text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive',
      )}
      onClick={handleToggle}
    >
      <div className="relative">
        <div
          className={classNames('text-xl transition-all', isChatMode ? 'i-ph:chat-circle-fill' : 'i-ph:chat-circle')}
        />
        {isChatMode && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-bolt-elements-background-depth-1" />
        )}
      </div>
    </IconButton>
  );
});

interface FilePreview {
  file: File;
  preview: string;
}

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  fileInputRef?: React.RefObject<HTMLInputElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  messages?: Message[];
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  selectedFiles?: FilePreview[];
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  onFileSelect?: () => void;
  onFileRemove?: (index: number) => void;
  onEditMessage?: (index: number) => void;
  onDeleteMessage?: (index: number) => void;
  onRegenerateMessage?: (index: number) => void;
}

const CATEGORY_PROMPTS = [
  { label: 'Landing Page', icon: 'i-ph:browser', prompt: 'Crée-moi une landing page moderne et responsive' },
  { label: 'E-commerce', icon: 'i-ph:shopping-cart', prompt: 'Développe une boutique e-commerce minimaliste' },
  { label: 'Dashboard', icon: 'i-ph:chart-line-up', prompt: 'Génère un dashboard analytics avec des graphiques' },
  { label: 'Portfolio', icon: 'i-ph:images', prompt: 'Construis un portfolio créatif pour un designer' },
  { label: 'Blog', icon: 'i-ph:article', prompt: 'Crée un blog moderne avec système de posts' },
];

const TEXTAREA_MIN_HEIGHT = 76;

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      fileInputRef: _fileInputRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      enhancingPrompt = false,
      promptEnhanced = false,
      messages,
      input = '',
      selectedFiles = [],
      sendMessage,
      handleInputChange,
      enhancePrompt,
      handleStop,
      onFileSelect,
      onFileRemove,
      onEditMessage,
      onDeleteMessage,
      onRegenerateMessage,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const hasPreloadedOnFirstMessage = useRef(false);
    const showWorkbench = useStore(workbenchStore.showWorkbench);

    // defer ColorBends loading by 500ms to prioritize UI
    const [showColorBends, setShowColorBends] = useState(false);

    useEffect(() => {
      if (chatStarted) {
        // don't show ColorBends if chat already started
        return undefined;
      }

      const timer = setTimeout(() => {
        setShowColorBends(true);
      }, 500);

      return () => clearTimeout(timer);
    }, [chatStarted]);

    // trigger preload when user focuses on textarea (about to type)
    const handleTextareaFocus = useCallback(() => {
      preloadOnTypingStart();
    }, []);

    // wrap sendMessage to trigger preload on first message
    const handleSendMessage = useCallback(
      (event: React.UIEvent, messageInput?: string) => {
        if (!hasPreloadedOnFirstMessage.current) {
          hasPreloadedOnFirstMessage.current = true;
          preloadOnFirstMessage();
        }

        sendMessage?.(event, messageInput);
      },
      [sendMessage],
    );

    return (
      <div
        ref={ref}
        className={classNames(
          styles.BaseChat,
          'relative flex h-full w-full overflow-hidden',
          chatStarted ? 'bg-bolt-elements-background-depth-1' : styles.welcomeGradient,
        )}
        data-chat-visible={showChat}
      >
        {/* ColorBends animated background - only on welcome screen, deferred by 500ms */}
        {!chatStarted && (
          <ClientOnly fallback={<div className={classNames('absolute inset-0', styles.welcomeGradient)} />}>
            {() =>
              showColorBends ? (
                <ColorBends
                  className="absolute inset-0 z-0"
                  speed={0.15}
                  noise={0.08}
                  mouseInfluence={0.5}
                  parallax={0.3}
                />
              ) : (
                <div className={classNames('absolute inset-0', styles.welcomeGradient)} />
              )
            }
          </ClientOnly>
        )}
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div className="flex w-full h-full">
          <div
            ref={scrollRef}
            className={classNames(
              styles.Chat,
              'flex flex-col flex-grow min-w-[var(--chat-min-width)] h-full overflow-y-auto',
              { [styles.chatWithWorkbench]: showWorkbench },
            )}
          >
            {!chatStarted && (
              <div id="intro" className="mt-[12vh] max-w-chat mx-auto">
                <h1 className="text-5xl text-center font-bold bg-gradient-to-r from-gray-900 via-gray-900 to-accent-600 dark:from-white dark:via-white dark:to-accent-300 bg-clip-text text-transparent mb-2">
                  Vous imaginez, on réalise
                </h1>
                <p className="mb-6 text-center text-gray-600 dark:text-gray-300">
                  Décrivez votre projet app, website et BAVINI le crée pour vous.
                </p>
                <TemplatePills
                  onSelectTemplate={(prompt) => {
                    handleSendMessage({} as React.UIEvent, prompt);
                  }}
                />
              </div>
            )}
            <div
              className={classNames('pt-6 px-6', {
                'h-full flex flex-col': chatStarted,
              })}
            >
              <ClientOnly>
                {() => {
                  if (!chatStarted) {
                    return null;
                  }

                  return (
                    <Messages
                      ref={messageRef}
                      className="flex flex-col w-full flex-1 max-w-chat px-4 pb-6 mx-auto z-1"
                      messages={messages}
                      isStreaming={isStreaming}
                      onEditMessage={onEditMessage}
                      onDeleteMessage={onDeleteMessage}
                      onRegenerateMessage={onRegenerateMessage}
                    />
                  );
                }}
              </ClientOnly>
              <div
                className={classNames('relative w-full max-w-chat mx-auto z-prompt', {
                  'sticky bottom-0': chatStarted,
                })}
              >
                <div
                  className={classNames(
                    'shadow-sm border border-bolt-elements-borderColor bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] rounded-lg overflow-hidden',
                    { [styles.welcomeInput]: !chatStarted },
                  )}
                >
                  {/* File Previews */}
                  {selectedFiles.length > 0 && (
                    <div className="flex gap-2 p-3 pb-0 flex-wrap">
                      {selectedFiles.map((filePreview, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={filePreview.preview}
                            alt={filePreview.file.name}
                            className="w-16 h-16 object-cover rounded-lg border border-bolt-elements-borderColor"
                          />
                          <button
                            onClick={() => onFileRemove?.(index)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Supprimer"
                          >
                            <div className="i-ph:x text-xs" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 rounded-b-lg truncate">
                            {filePreview.file.name.length > 10
                              ? `${filePreview.file.name.slice(0, 10)}...`
                              : filePreview.file.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <AnimatedPlaceholder chatStarted={chatStarted} textareaRef={textareaRef} />
                    <textarea
                      ref={textareaRef}
                      className="w-full pl-4 pt-4 pr-4 pb-3 focus:outline-none resize-none text-md text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent"
                      onFocus={handleTextareaFocus}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          if (event.shiftKey) {
                            return;
                          }

                          event.preventDefault();

                          handleSendMessage(event);
                        }
                      }}
                      value={input}
                      onChange={(event) => {
                        handleInputChange?.(event);
                      }}
                      style={{
                        minHeight: TEXTAREA_MIN_HEIGHT,
                        maxHeight: TEXTAREA_MAX_HEIGHT,
                      }}
                      placeholder={chatStarted ? 'Comment BAVINI peut-il vous aider ?' : ''}
                      aria-label="Message à envoyer à BAVINI"
                      translate="no"
                    />
                  </div>
                  <div className="flex justify-between items-center text-sm p-4 pt-2">
                    <div className="flex gap-2 items-center">
                      <IconButton
                        title="Joindre une image"
                        className="text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive"
                        onClick={() => onFileSelect?.()}
                      >
                        <div className="i-ph:plus text-xl"></div>
                      </IconButton>
                      <IconButton
                        title="Améliorer le prompt"
                        disabled={input.length === 0 || enhancingPrompt}
                        className={classNames({
                          'opacity-100!': enhancingPrompt,
                          'text-bolt-elements-item-contentAccent! pr-1.5 enabled:hover:bg-bolt-elements-item-backgroundAccent!':
                            promptEnhanced,
                        })}
                        onClick={() => enhancePrompt?.()}
                      >
                        {enhancingPrompt ? (
                          <>
                            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl"></div>
                            <div className="ml-1.5">Amélioration en cours...</div>
                          </>
                        ) : (
                          <>
                            <div className="i-bolt:stars text-xl"></div>
                            {promptEnhanced && <div className="ml-1.5">Prompt amélioré</div>}
                          </>
                        )}
                      </IconButton>
                      <ChatModeToggle />
                      <MultiAgentToggle />
                    </div>
                    <ClientOnly>
                      {() => (
                        <SendButton
                          hasContent={input.length > 0 || selectedFiles.length > 0}
                          isStreaming={isStreaming}
                          onClick={(event) => {
                            if (isStreaming) {
                              handleStop?.();
                              return;
                            }

                            handleSendMessage(event);
                          }}
                        />
                      )}
                    </ClientOnly>
                  </div>
                </div>
                <div className="pb-6">{/* Ghost Element */}</div>
              </div>
            </div>
            {!chatStarted && (
              <div id="categories" className="relative w-full max-w-2xl mx-auto mt-8 pb-12 flex justify-center">
                <div className="flex flex-nowrap gap-2 justify-center">
                  {CATEGORY_PROMPTS.map((category, index) => (
                    <button
                      key={index}
                      onClick={(event) => {
                        handleSendMessage(event, category.prompt);
                      }}
                      className="group flex items-center justify-center gap-2 px-4 py-2 min-w-[120px] shrink-0 rounded-full border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 hover:border-accent-500 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-all duration-200"
                    >
                      <div
                        className={classNames(category.icon, 'text-base group-hover:text-accent-500 transition-colors')}
                      />
                      <span className="text-sm font-medium">{category.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <ClientOnly>
            {() => (
              <div className="flex-shrink-0 h-full" onMouseEnter={preloadOnWorkbenchInteraction}>
                <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />
              </div>
            )}
          </ClientOnly>
        </div>
      </div>
    );
  },
);
