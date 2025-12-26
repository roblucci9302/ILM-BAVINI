import { AnimatePresence, cubicBezier, motion } from 'framer-motion';

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
          className={`absolute flex justify-center items-center bottom-[68px] right-[12px] p-2.5 rounded-full transition-theme ${
            isStreaming
              ? 'bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white'
              : 'bg-accent-500/20 text-accent-500 hover:bg-accent-500 hover:text-white'
          }`}
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
