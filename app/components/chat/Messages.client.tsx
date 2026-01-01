import type { Message } from 'ai';
import React, { useCallback } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
  onEditMessage?: (index: number, newContent: string) => void;
  onDeleteMessage?: (index: number) => void;
  onRegenerateMessage?: (index: number) => void;
}

export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>((props: MessagesProps, ref) => {
  const { id, isStreaming = false, messages = [], onEditMessage, onDeleteMessage, onRegenerateMessage } = props;

  // Handlers for message actions
  const handleEditMessage = useCallback((index: number) => {
    // For now, we'll just trigger the callback - the actual edit UI can be added later
    const message = messages[index];
    if (message && onEditMessage) {
      // In a full implementation, this would open an edit modal/input
      onEditMessage(index, typeof message.content === 'string' ? message.content : '');
    }
  }, [messages, onEditMessage]);

  const handleDeleteMessage = useCallback((index: number) => {
    onDeleteMessage?.(index);
  }, [onDeleteMessage]);

  const handleRegenerateMessage = useCallback((index: number) => {
    onRegenerateMessage?.(index);
  }, [onRegenerateMessage]);

  return (
    <div id={id} ref={ref} className={props.className} role="log" aria-label="Historique de la conversation" aria-live="polite">
      {messages.length > 0
        ? messages.map((message, index) => {
            const { role, content } = message;
            const isUserMessage = role === 'user';
            const isFirst = index === 0;
            const isLast = index === messages.length - 1;

            return (
              <div
                key={index}
                className={classNames('flex gap-4 p-6 w-full rounded-[calc(0.75rem-1px)]', {
                  'bg-bolt-elements-messages-background': isUserMessage || !isStreaming || (isStreaming && !isLast),
                  'bg-gradient-to-b from-bolt-elements-messages-background from-30% to-transparent':
                    isStreaming && isLast,
                  'mt-5': !isFirst, /* Improved spacing: mt-4 → mt-5 (16px → 20px) */
                })}
              >
                {isUserMessage && (
                  <div className="flex items-center justify-center w-[34px] h-[34px] overflow-hidden bg-white text-gray-600 rounded-full shrink-0 self-start">
                    <div className="i-ph:user-fill text-xl"></div>
                  </div>
                )}
                <div className="grid grid-cols-1 w-full">
                  {isUserMessage ? (
                    <UserMessage
                      content={content}
                      messageIndex={index}
                      onEdit={onEditMessage ? handleEditMessage : undefined}
                      onDelete={onDeleteMessage ? handleDeleteMessage : undefined}
                    />
                  ) : (
                    <AssistantMessage
                      content={content}
                      messageIndex={index}
                      isLast={isLast}
                      isStreaming={isStreaming}
                      onRegenerate={onRegenerateMessage ? handleRegenerateMessage : undefined}
                    />
                  )}
                </div>
              </div>
            );
          })
        : null}
      {isStreaming && (
        <div
          className="text-center w-full text-bolt-elements-textSecondary i-svg-spinners:3-dots-fade text-4xl mt-4"
          role="status"
          aria-live="polite"
          aria-label="Génération de la réponse en cours"
        />
      )}
    </div>
  );
});

Messages.displayName = 'Messages';
