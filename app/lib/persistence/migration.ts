/**
 * Migration utilities for IndexedDB to PGlite.
 * Handles one-time migration of existing chat data.
 */

import type { PGlite } from '@electric-sql/pglite';
import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('Migration');

const MIGRATION_KEY = 'bavini_pglite_migrated';
const LEGACY_DB_NAME = 'boltHistory';
const LEGACY_STORE_NAME = 'chats';

interface LegacyChatItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
}

/**
 * Check if migration has already been completed.
 */
export function isMigrationComplete(): boolean {
  try {
    return localStorage.getItem(MIGRATION_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark migration as complete.
 */
export function markMigrationComplete(): void {
  try {
    localStorage.setItem(MIGRATION_KEY, 'true');
  } catch {
    logger.warn('Could not save migration status to localStorage');
  }
}

/**
 * Open the legacy IndexedDB database.
 */
async function openLegacyDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(LEGACY_DB_NAME, 1);

      request.onerror = () => {
        logger.debug('No legacy database found');
        resolve(null);
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // check if the store exists
        if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
          db.close();
          resolve(null);

          return;
        }

        resolve(db);
      };

      request.onupgradeneeded = () => {
        // if we're upgrading, the db doesn't have our data
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Get all chats from the legacy IndexedDB.
 */
async function getLegacyChats(db: IDBDatabase): Promise<LegacyChatItem[]> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(LEGACY_STORE_NAME, 'readonly');
      const store = transaction.objectStore(LEGACY_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as LegacyChatItem[]);
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Migrate data from IndexedDB to PGlite.
 */
export async function migrateFromIndexedDB(pglite: PGlite): Promise<{ migrated: number; errors: number }> {
  const stats = { migrated: 0, errors: 0 };

  // skip if already migrated
  if (isMigrationComplete()) {
    logger.debug('Migration already complete, skipping');

    return stats;
  }

  logger.info('Starting migration from IndexedDB to PGlite...');

  try {
    // open legacy database
    const legacyDb = await openLegacyDatabase();

    if (!legacyDb) {
      logger.info('No legacy database found, nothing to migrate');
      markMigrationComplete();

      return stats;
    }

    // get all chats
    const chats = await getLegacyChats(legacyDb);

    logger.info(`Found ${chats.length} chats to migrate`);

    // close legacy connection
    legacyDb.close();

    if (chats.length === 0) {
      markMigrationComplete();

      return stats;
    }

    // migrate each chat
    for (const chat of chats) {
      try {
        await pglite.query(
          `INSERT INTO chats (id, url_id, description, messages, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $5)
           ON CONFLICT (id) DO UPDATE SET
             url_id = EXCLUDED.url_id,
             description = EXCLUDED.description,
             messages = EXCLUDED.messages,
             updated_at = EXCLUDED.updated_at`,
          [
            chat.id,
            chat.urlId || null,
            chat.description || null,
            JSON.stringify(chat.messages),
            chat.timestamp || new Date().toISOString(),
          ],
        );

        stats.migrated++;
      } catch (error) {
        logger.error(`Failed to migrate chat ${chat.id}:`, error);
        stats.errors++;
      }
    }

    logger.info(`Migration complete: ${stats.migrated} migrated, ${stats.errors} errors`);

    // mark as complete only if no errors
    if (stats.errors === 0) {
      markMigrationComplete();
    }

    return stats;
  } catch (error) {
    logger.error('Migration failed:', error);

    return stats;
  }
}

/**
 * Check if there is legacy data to migrate.
 */
export async function hasLegacyData(): Promise<boolean> {
  if (isMigrationComplete()) {
    return false;
  }

  const db = await openLegacyDatabase();

  if (!db) {
    return false;
  }

  try {
    const chats = await getLegacyChats(db);
    db.close();

    return chats.length > 0;
  } catch {
    db.close();

    return false;
  }
}
