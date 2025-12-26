/**
 * Miro SDK.
 *
 * Lightweight client for Miro API.
 */

// Types
export interface MiroBoard {
  id: string;
  name: string;
  description: string;
  viewLink: string;
  createdAt: string;
  modifiedAt: string;
}

export interface MiroItem {
  id: string;
  type: string;
  data: Record<string, unknown>;
  position: { x: number; y: number };
  geometry?: { width: number; height: number };
}

export interface MiroStickyNote extends MiroItem {
  type: 'sticky_note';
  data: { content: string; shape: string };
  style: { fillColor: string };
}

export interface MiroShape extends MiroItem {
  type: 'shape';
  data: { shape: string; content?: string };
}

export interface MiroConnector {
  id: string;
  type: 'connector';
  startItem: { id: string };
  endItem: { id: string };
  caption?: string;
}

export interface CreateBoardOptions {
  name: string;
  description?: string;
  teamId?: string;
}

export interface CreateStickyNoteOptions {
  content: string;
  position: { x: number; y: number };
  fillColor?: string;
  width?: number;
}

export interface CreateShapeOptions {
  shape: 'rectangle' | 'circle' | 'triangle' | 'rhombus';
  position: { x: number; y: number };
  width: number;
  height: number;
  content?: string;
}

// Client
export class MiroClient {
  private readonly accessToken: string;
  private readonly baseUrl = 'https://api.miro.com/v2';

  constructor(config: { accessToken: string }) {
    if (!config.accessToken) {
      throw new Error('Miro access token is required');
    }

    this.accessToken = config.accessToken;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(error.message || `Miro API error: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.request('GET', '/users/me');
      return true;
    } catch {
      return false;
    }
  }
}

export function createMiroClient(accessToken: string): MiroClient {
  return new MiroClient({ accessToken });
}

// Board functions
export async function listBoards(
  client: MiroClient,
  options?: { teamId?: string; limit?: number },
): Promise<MiroBoard[]> {
  const params = new URLSearchParams();

  if (options?.teamId) {
    params.set('team_id', options.teamId);
  }

  if (options?.limit) {
    params.set('limit', String(options.limit));
  }

  const query = params.toString();
  const result = await client.request<{ data: MiroBoard[] }>('GET', `/boards${query ? `?${query}` : ''}`);

  return result.data;
}

export async function getBoard(client: MiroClient, boardId: string): Promise<MiroBoard> {
  return client.request('GET', `/boards/${boardId}`);
}

export async function createBoard(client: MiroClient, options: CreateBoardOptions): Promise<MiroBoard> {
  return client.request('POST', '/boards', {
    name: options.name,
    description: options.description,
    teamId: options.teamId,
  });
}

export async function updateBoard(
  client: MiroClient,
  boardId: string,
  updates: Partial<CreateBoardOptions>,
): Promise<MiroBoard> {
  return client.request('PATCH', `/boards/${boardId}`, updates);
}

export async function deleteBoard(client: MiroClient, boardId: string): Promise<void> {
  await client.request('DELETE', `/boards/${boardId}`);
}

export async function copyBoard(client: MiroClient, boardId: string, name: string): Promise<MiroBoard> {
  return client.request('POST', `/boards/${boardId}/copy`, { name });
}

// Item functions
export async function listItems(
  client: MiroClient,
  boardId: string,
  options?: { type?: string; limit?: number },
): Promise<MiroItem[]> {
  const params = new URLSearchParams();

  if (options?.type) {
    params.set('type', options.type);
  }

  if (options?.limit) {
    params.set('limit', String(options.limit));
  }

  const query = params.toString();
  const result = await client.request<{ data: MiroItem[] }>(
    'GET',
    `/boards/${boardId}/items${query ? `?${query}` : ''}`,
  );

  return result.data;
}

export async function getItem(client: MiroClient, boardId: string, itemId: string): Promise<MiroItem> {
  return client.request('GET', `/boards/${boardId}/items/${itemId}`);
}

export async function deleteItem(client: MiroClient, boardId: string, itemId: string): Promise<void> {
  await client.request('DELETE', `/boards/${boardId}/items/${itemId}`);
}

// Sticky note functions
export async function createStickyNote(
  client: MiroClient,
  boardId: string,
  options: CreateStickyNoteOptions,
): Promise<MiroStickyNote> {
  return client.request('POST', `/boards/${boardId}/sticky_notes`, {
    data: { content: options.content },
    position: options.position,
    style: options.fillColor ? { fillColor: options.fillColor } : undefined,
    geometry: options.width ? { width: options.width } : undefined,
  });
}

export async function updateStickyNote(
  client: MiroClient,
  boardId: string,
  itemId: string,
  updates: Partial<CreateStickyNoteOptions>,
): Promise<MiroStickyNote> {
  const body: Record<string, unknown> = {};

  if (updates.content) {
    body.data = { content: updates.content };
  }

  if (updates.position) {
    body.position = updates.position;
  }

  if (updates.fillColor) {
    body.style = { fillColor: updates.fillColor };
  }

  return client.request('PATCH', `/boards/${boardId}/sticky_notes/${itemId}`, body);
}

// Shape functions
export async function createShape(
  client: MiroClient,
  boardId: string,
  options: CreateShapeOptions,
): Promise<MiroShape> {
  return client.request('POST', `/boards/${boardId}/shapes`, {
    data: { shape: options.shape, content: options.content },
    position: options.position,
    geometry: { width: options.width, height: options.height },
  });
}

// Text functions
export async function createText(
  client: MiroClient,
  boardId: string,
  options: { content: string; position: { x: number; y: number }; width?: number },
): Promise<MiroItem> {
  return client.request('POST', `/boards/${boardId}/texts`, {
    data: { content: options.content },
    position: options.position,
    geometry: options.width ? { width: options.width } : undefined,
  });
}

// Frame functions
export async function createFrame(
  client: MiroClient,
  boardId: string,
  title: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
): Promise<MiroItem> {
  return client.request('POST', `/boards/${boardId}/frames`, {
    data: { title },
    position,
    geometry: size,
  });
}

// Connector functions
export async function createConnector(
  client: MiroClient,
  boardId: string,
  startItemId: string,
  endItemId: string,
  options?: { style?: string; caption?: string },
): Promise<MiroConnector> {
  return client.request('POST', `/boards/${boardId}/connectors`, {
    startItem: { id: startItemId },
    endItem: { id: endItemId },
    style: options?.style ? { strokeStyle: options.style } : undefined,
    captions: options?.caption ? [{ content: options.caption }] : undefined,
  });
}

// Utility functions
export async function createMindMap(
  client: MiroClient,
  boardId: string,
  centerTopic: string,
  branches: string[],
): Promise<{ center: MiroStickyNote; branches: MiroStickyNote[] }> {
  // Create center node
  const center = await createStickyNote(client, boardId, {
    content: centerTopic,
    position: { x: 0, y: 0 },
    fillColor: 'light_blue',
    width: 200,
  });

  // Create branch nodes
  const branchItems: MiroStickyNote[] = [];
  const angleStep = (2 * Math.PI) / branches.length;
  const radius = 300;

  for (let i = 0; i < branches.length; i++) {
    const angle = i * angleStep - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    const branch = await createStickyNote(client, boardId, {
      content: branches[i],
      position: { x, y },
      fillColor: 'yellow',
    });

    // Connect to center
    await createConnector(client, boardId, center.id, branch.id);
    branchItems.push(branch);
  }

  return { center, branches: branchItems };
}
