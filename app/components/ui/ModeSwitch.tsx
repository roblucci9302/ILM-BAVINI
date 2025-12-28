import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import { memo } from 'react';
import { chatStore, setChatMode, type ChatMode } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';

interface ModeSwitchProps {
  className?: string;
}

interface ModeOption {
  value: ChatMode;
  label: string;
  icon: string;
  description: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: 'chat',
    label: 'Chat',
    icon: 'i-ph:chat-circle-text',
    description: 'Mode analyse - lecture seule',
  },
  {
    value: 'auto',
    label: 'Auto',
    icon: 'i-ph:magic-wand',
    description: 'Détection automatique',
  },
  {
    value: 'agent',
    label: 'Agent',
    icon: 'i-ph:robot',
    description: 'Mode action - modifications',
  },
];

export const ModeSwitch = memo(({ className }: ModeSwitchProps) => {
  const { mode } = useStore(chatStore);

  return (
    <div
      className={classNames(
        'flex items-center gap-0.5 bg-bolt-elements-background-depth-2 rounded-lg p-1 border border-bolt-elements-borderColor',
        className,
      )}
    >
      {MODE_OPTIONS.map((option) => (
        <ModeButton
          key={option.value}
          option={option}
          selected={mode === option.value}
          onClick={() => setChatMode(option.value)}
        />
      ))}
    </div>
  );
});

interface ModeButtonProps {
  option: ModeOption;
  selected: boolean;
  onClick: () => void;
}

const ModeButton = memo(({ option, selected, onClick }: ModeButtonProps) => {
  return (
    <button
      onClick={onClick}
      title={option.description}
      className={classNames(
        'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
        selected
          ? 'text-bolt-elements-item-contentAccent'
          : 'text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive',
      )}
    >
      {selected && (
        <motion.span
          layoutId="mode-indicator"
          transition={{ duration: 0.2, ease: cubicEasingFn }}
          className="absolute inset-0 z-0 bg-bolt-elements-item-backgroundAccent rounded-md"
        />
      )}
      <span className={classNames(option.icon, 'text-sm relative z-10')} />
      <span className="relative z-10 hidden sm:inline">{option.label}</span>
    </button>
  );
});
