/**
 * PGlite wrapper for BAVINI chat persistence.
 * Provides initialization, schema management, and query helpers.
 */

import { PGlite } from '@electric-sql/pglite';
import { createScopedLogger } from '~/utils/logger';
import { CREATE_TABLES_SQL, INSERT_SCHEMA_VERSION_SQL, SCHEMA_VERSION } from './schema';

const logger = createScopedLogger('PGlite');

const PGLITE_DB_NAME = 'idb://bavini-chats';

let pgliteInstance: PGlite | null = null;

/**
 * Initialize PGlite database with schema.
 */
export async function initPGlite(): Promise<PGlite> {
  if (pgliteInstance) {
    return pgliteInstance;
  }

  logger.info('Initializing PGlite database...');

  try {
    const db = new PGlite(PGLITE_DB_NAME, {
      relaxedDurability: true,
    });

    await db.waitReady;

    // create tables if they don't exist
    await db.exec(CREATE_TABLES_SQL);

    // record schema version
    await db.query(INSERT_SCHEMA_VERSION_SQL, [SCHEMA_VERSION]);

    logger.info('PGlite database initialized successfully');

    pgliteInstance = db;

    return db;
  } catch (error) {
    logger.error('Failed to initialize PGlite:', error);
    throw error;
  }
}

/**
 * Get the PGlite instance, initializing if needed.
 */
export async function getPGlite(): Promise<PGlite> {
  if (!pgliteInstance) {
    return initPGlite();
  }

  return pgliteInstance;
}

/**
 * Close the PGlite connection.
 */
export async function closePGlite(): Promise<void> {
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
    logger.info('PGlite connection closed');
  }
}

/**
 * Check if PGlite is available and working.
 */
export async function isPGliteAvailable(): Promise<boolean> {
  try {
    const db = await initPGlite();
    const result = await db.query('SELECT 1 as test');

    return result.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Execute a query and return typed results.
 */
export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const db = await getPGlite();
  const result = await db.query(sql, params);

  return result.rows as T[];
}

/**
 * Execute a query and return a single result.
 */
export async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const results = await query<T>(sql, params);

  return results[0] || null;
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE).
 */
export async function execute(sql: string, params?: unknown[]): Promise<number> {
  const db = await getPGlite();
  const result = await db.query(sql, params);

  return result.affectedRows || 0;
}
