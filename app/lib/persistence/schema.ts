/**
 * PGlite database schema for BAVINI chat persistence.
 */

export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    url_id TEXT UNIQUE,
    description TEXT,
    messages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_chats_url_id ON chats(url_id);
  CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);

  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

export const INSERT_SCHEMA_VERSION_SQL = `
  INSERT INTO schema_version (version)
  VALUES ($1)
  ON CONFLICT (version) DO NOTHING;
`;

export const GET_SCHEMA_VERSION_SQL = `
  SELECT MAX(version) as version FROM schema_version;
`;
