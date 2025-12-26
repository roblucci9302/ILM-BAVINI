import { memo, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const PLACEHOLDER_WORDS = [
  'une interface',
  'un Dashboard',
  'une Landing page',
  'un blog',
  'une Web app',
  'un prototype',
  'un outil interne',
  'une boutique en ligne',
  'un portfolio',
];

const TYPING_SPEED = 80; // ms per character
const DELETING_SPEED = 40; // ms per character (faster deletion)
const PAUSE_BEFORE_DELETE = 2000; // ms to wait before deleting

interface AnimatedPlaceholderProps {
  show: boolean;
}

export const AnimatedPlaceholder = memo(({ show }: AnimatedPlaceholderProps) => {
  const [wordIndex, setWordIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!show) {
      return undefined;
    }

    const currentWord = PLACEHOLDER_WORDS[wordIndex];

    // calculate delay based on state
    let delay = TYPING_SPEED;

    if (isDeleting) {
      delay = DELETING_SPEED;
    } else if (displayedText.length === currentWord.length) {
      delay = PAUSE_BEFORE_DELETE;
    }

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // typing
        if (displayedText.length < currentWord.length) {
          setDisplayedText(currentWord.slice(0, displayedText.length + 1));
        } else {
          // finished typing, start deleting
          setIsDeleting(true);
        }
      } else {
        // deleting
        if (displayedText.length > 0) {
          setDisplayedText(displayedText.slice(0, -1));
        } else {
          // finished deleting, move to next word
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % PLACEHOLDER_WORDS.length);
        }
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, wordIndex, show]);

  // reset when hidden
  useEffect(() => {
    if (!show) {
      setDisplayedText('');
      setIsDeleting(false);
      setWordIndex(0);
    }
  }, [show]);

  if (!show) {
    return null;
  }

  return (
    <div
      className="absolute top-4 left-4 right-16 pointer-events-none text-bolt-elements-textTertiary text-md"
      aria-hidden="true"
    >
      <span>Créer </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={wordIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="text-bolt-elements-textSecondary"
        >
          {displayedText}
        </motion.span>
      </AnimatePresence>
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
        className="text-accent-500 ml-0.5"
      >
        |
      </motion.span>
    </div>
  );
});
