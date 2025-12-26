/**
 * Notion SDK.
 *
 * Lightweight client for Notion API.
 */

// Types
export interface NotionPage {
  object: 'page';
  id: string;
  parent: { type: string; page_id?: string; database_id?: string };
  properties: Record<string, unknown>;
  url: string;
  archived: boolean;
}

export interface NotionDatabase {
  object: 'database';
  id: string;
  title: Array<{ plain_text: string }>;
  properties: Record<string, unknown>;
}

export interface NotionBlock {
  object: 'block';
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface NotionSearchResult {
  object: 'list';
  results: Array<NotionPage | NotionDatabase>;
  has_more: boolean;
  next_cursor: string | null;
}

export interface QueryDatabaseResult {
  object: 'list';
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface CreatePageOptions {
  parent: { page_id?: string; database_id?: string };
  properties: Record<string, unknown>;
  children?: unknown[];
}

export interface QueryDatabaseOptions {
  filter?: Record<string, unknown>;
  sorts?: Array<{ property: string; direction: 'ascending' | 'descending' }>;
  page_size?: number;
  start_cursor?: string;
}

// Client
export class NotionClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.notion.com/v1';
  private readonly version = '2022-06-28';

  constructor(config: { apiKey: string }) {
    if (!config.apiKey) {
      throw new Error('Notion API key is required');
    }

    this.apiKey = config.apiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Notion-Version': this.version,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(error.message || `Notion API error: ${response.status}`);
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async validateKey(): Promise<boolean> {
    try {
      await this.get('/users/me');
      return true;
    } catch {
      return false;
    }
  }
}

export function createNotionClient(apiKey: string): NotionClient {
  return new NotionClient({ apiKey });
}

// Page functions
export async function getPage(client: NotionClient, pageId: string): Promise<NotionPage> {
  return client.get(`/pages/${pageId}`);
}

export async function createPage(client: NotionClient, options: CreatePageOptions): Promise<NotionPage> {
  return client.post('/pages', options);
}

export async function updatePage(
  client: NotionClient,
  pageId: string,
  properties: Record<string, unknown>,
): Promise<NotionPage> {
  return client.patch(`/pages/${pageId}`, { properties });
}

export async function archivePage(client: NotionClient, pageId: string): Promise<NotionPage> {
  return client.patch(`/pages/${pageId}`, { archived: true });
}

export async function appendBlocks(
  client: NotionClient,
  blockId: string,
  children: unknown[],
): Promise<{ object: 'list'; results: NotionBlock[] }> {
  return client.patch(`/blocks/${blockId}/children`, { children });
}

// Database functions
export async function queryDatabase(
  client: NotionClient,
  databaseId: string,
  options?: QueryDatabaseOptions,
): Promise<QueryDatabaseResult> {
  return client.post(`/databases/${databaseId}/query`, options || {});
}

export async function getDatabase(client: NotionClient, databaseId: string): Promise<NotionDatabase> {
  return client.get(`/databases/${databaseId}`);
}

// Search
export async function search(
  client: NotionClient,
  query: string,
  options?: { filter?: { property: string; value: string }; page_size?: number },
): Promise<NotionSearchResult> {
  return client.post('/search', { query, ...options });
}

// Block helpers
export function createParagraph(text: string): Record<string, unknown> {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

export function createHeading1(text: string): Record<string, unknown> {
  return {
    object: 'block',
    type: 'heading_1',
    heading_1: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

export function createHeading2(text: string): Record<string, unknown> {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

export function createBulletedList(items: string[]): Record<string, unknown>[] {
  return items.map((item) => ({
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: item } }],
    },
  }));
}

export function createTodo(text: string, checked = false): Record<string, unknown> {
  return {
    object: 'block',
    type: 'to_do',
    to_do: {
      rich_text: [{ type: 'text', text: { content: text } }],
      checked,
    },
  };
}
