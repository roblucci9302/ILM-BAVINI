import { useLoaderData, useNavigate } from '@remix-run/react';
import { useState, useEffect, useRef } from 'react';
import { atom } from 'nanostores';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { getMessages, getNextId, getUrlId, openDatabase, setMessages, type Database } from './db';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

// Database instance - initialized lazily, not at module load
let dbInstance: Database | undefined;
let dbInitPromise: Promise<Database | undefined> | null = null;
let dbInitComplete = false;

/**
 * Lazy database initialization with timeout
 * Returns the database instance or undefined if init fails/times out
 */
export async function getDatabase(): Promise<Database | undefined> {
  // Return cached instance if available
  if (dbInstance) {
    return dbInstance;
  }

  if (!persistenceEnabled) {
    return undefined;
  }

  // If already initializing, wait for that promise
  if (dbInitPromise) {
    return dbInitPromise;
  }

  // Start initialization with timeout (15s for WASM loading)
  const initPromise = openDatabase();
  const timeoutPromise = new Promise<undefined>((resolve) => {
    setTimeout(() => {
      if (!dbInitComplete) {
        console.warn('[DB] Database initialization timed out after 15s');
        resolve(undefined);
      }
    }, 15000);
  });

  dbInitPromise = Promise.race([initPromise, timeoutPromise])
    .then((db) => {
      dbInitComplete = true;
      dbInstance = db;
      return db;
    })
    .catch((error) => {
      console.error('[DB] Database initialization failed:', error);
      dbInitComplete = true;
      return undefined;
    });

  // Also handle the case where init completes after timeout
  initPromise.then((db) => {
    if (db && !dbInstance) {
      dbInstance = db;
      console.info('[DB] Database initialized (after timeout)');
    }
  }).catch(() => {
    // Already handled above
  });

  return dbInitPromise;
}

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);

export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();

  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [dbReady, setDbReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();
  const dbRef = useRef<Database | undefined>(undefined);

  // Initialize database lazily
  useEffect(() => {
    let cancelled = false;

    getDatabase().then((db) => {
      if (cancelled) return;

      dbRef.current = db;
      setDbReady(true);

      if (!db) {
        // Database not available, but we can still use the app
        setReady(true);

        if (persistenceEnabled) {
          toast.error(`La sauvegarde des conversations n'est pas disponible`);
        }

        return;
      }

      // If we have a chat ID in URL, load messages
      if (mixedId) {
        getMessages(db, mixedId)
          .then((storedMessages) => {
            if (cancelled) return;

            if (storedMessages && storedMessages.messages.length > 0) {
              setInitialMessages(storedMessages.messages);
              setUrlId(storedMessages.urlId);
              description.set(storedMessages.description);
              chatId.set(storedMessages.id);
            } else {
              navigate(`/`, { replace: true });
            }

            setReady(true);
          })
          .catch((error) => {
            if (cancelled) return;
            console.error('[DB] Failed to load messages:', error);
            toast.error('Erreur lors du chargement de la conversation');
            setReady(true); // Still set ready so UI can render
          });
      } else {
        // No mixedId, ready immediately
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [mixedId, navigate]);

  return {
    // Ready immediately if no mixedId, otherwise wait for DB + messages
    ready: !mixedId || ready,
    initialMessages,
    dbReady,
    storeMessageHistory: async (messages: Message[]) => {
      const db = dbRef.current;

      if (!db || messages.length === 0) {
        return;
      }

      const { firstArtifact } = workbenchStore;

      if (!urlId && firstArtifact?.id) {
        const newUrlId = await getUrlId(db, firstArtifact.id);

        navigateChat(newUrlId);
        setUrlId(newUrlId);
      }

      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);
      }

      if (initialMessages.length === 0 && !chatId.get()) {
        const nextId = await getNextId(db);

        chatId.set(nextId);

        if (!urlId) {
          navigateChat(nextId);
        }
      }

      await setMessages(db, chatId.get() as string, messages, urlId, description.get());
    },
  };
}

function navigateChat(nextId: string) {
  /*
   * note: we use replaceState instead of Remix navigate() because navigate()
   * causes a rerender of <Chat /> that resets the streaming state.
   * this is the intended behavior - not a bug to fix.
   */
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
