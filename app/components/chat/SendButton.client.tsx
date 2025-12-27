import { AnimatePresence, cubicBezier, motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';

interface SendButtonProps {
  show: boolean;
  isStreaming?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

const customEasingFn = cubicBezier(0.4, 0, 0.2, 1);

export function SendButton({ show, isStreaming, onClick }: SendButtonProps) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          className={classNames(
            'absolute flex justify-center items-center bottom-[68px] right-[12px] p-2.5 rounded-full transition-theme border',
            isStreaming
              ? 'bg-bolt-elements-item-backgroundDanger text-bolt-elements-item-contentDanger border-bolt-elements-item-contentDanger/20 hover:bg-bolt-elements-button-danger-backgroundHover'
              : 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-bolt-elements-item-contentAccent/20 hover:bg-bolt-elements-button-primary-backgroundHover'
          )}
          transition={{ ease: customEasingFn, duration: 0.17 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={(event) => {
            event.preventDefault();
            onClick?.(event);
          }}
          title={isStreaming ? 'Arrêter' : 'Envoyer'}
        >
          {!isStreaming ? (
            <div className="i-ph:paper-plane-tilt-fill text-lg"></div>
          ) : (
            <div className="i-ph:stop-fill text-lg"></div>
          )}
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
