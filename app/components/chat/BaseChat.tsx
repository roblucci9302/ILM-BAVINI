import type { Message } from 'ai';
import React, { type RefCallback, useRef, useCallback } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { LazyColorBendsWrapper as ColorBends } from '~/components/ui/ColorBends.lazy';
import { Menu } from '~/components/sidebar/Menu.client';
import { IconButton } from '~/components/ui/IconButton';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import {
  preloadOnTypingStart,
  preloadOnFirstMessage,
  preloadOnWorkbenchInteraction,
} from '~/lib/performance';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';
import { TemplatePills } from './TemplatePills';

import styles from './BaseChat.module.scss';

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
}

const EXAMPLE_PROMPTS = [
  { text: 'Créer une application todo en React avec Tailwind' },
  { text: 'Créer un blog simple avec Astro' },
  { text: 'Créer un formulaire de consentement cookies avec Material UI' },
  { text: 'Créer un jeu Space Invaders' },
  { text: 'Comment centrer une div ?' },
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
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const hasPreloadedOnFirstMessage = useRef(false);

    // Trigger preload when user focuses on textarea (about to type)
    const handleTextareaFocus = useCallback(() => {
      preloadOnTypingStart();
    }, []);

    // Wrap sendMessage to trigger preload on first message
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
        {/* ColorBends animated background - only on welcome screen */}
        {!chatStarted && (
          <ClientOnly fallback={<div className={classNames('absolute inset-0', styles.welcomeGradient)} />}>
            {() => (
              <ColorBends
                className="absolute inset-0 z-0"
                speed={0.15}
                noise={0.08}
                mouseInfluence={0.5}
                parallax={0.3}
              />
            )}
          </ClientOnly>
        )}
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div ref={scrollRef} className="flex overflow-y-auto w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow min-w-[var(--chat-min-width)] h-full')}>
            {!chatStarted && (
              <div id="intro" className="mt-[20vh] max-w-chat mx-auto">
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
                  return chatStarted ? (
                    <Messages
                      ref={messageRef}
                      className="flex flex-col w-full flex-1 max-w-chat px-4 pb-6 mx-auto z-1"
                      messages={messages}
                      isStreaming={isStreaming}
                    />
                  ) : null;
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
                    <AnimatedPlaceholder show={!chatStarted && input.length === 0} />
                    <textarea
                      ref={textareaRef}
                      className={`w-full pl-4 pt-4 pr-12 focus:outline-none resize-none text-md text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent`}
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
                      translate="no"
                    />
                  </div>
                  <ClientOnly>
                    {() => (
                      <SendButton
                        show={input.length > 0 || isStreaming || selectedFiles.length > 0}
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
                    </div>
                    {input.length > 3 ? (
                      <div className="text-xs text-bolt-elements-textTertiary">
                        Utilisez <kbd className="kdb">Maj</kbd> + <kbd className="kdb">Entrée</kbd> pour une nouvelle
                        ligne
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="pb-6">{/* Ghost Element */}</div>
              </div>
            </div>
            {!chatStarted && (
              <div id="examples" className="relative w-full max-w-xl mx-auto mt-8 flex justify-center">
                <div className="flex flex-col space-y-2 [mask-image:linear-gradient(to_bottom,black_0%,transparent_180%)] hover:[mask-image:none]">
                  {EXAMPLE_PROMPTS.map((examplePrompt, index) => {
                    return (
                      <button
                        key={index}
                        onClick={(event) => {
                          handleSendMessage(event, examplePrompt.text);
                        }}
                        className="group flex items-center w-full gap-2 justify-center bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-theme"
                      >
                        {examplePrompt.text}
                        <div className="i-ph:arrow-bend-down-left" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <ClientOnly>
            {() => (
              <div className="flex-shrink-0" onMouseEnter={preloadOnWorkbenchInteraction}>
                <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />
              </div>
            )}
          </ClientOnly>
        </div>
      </div>
    );
  },
);
