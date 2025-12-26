/**
 * Figma SDK.
 *
 * Lightweight client for Figma API.
 */

// Types
export interface FigmaFile {
  name: string;
  lastModified: string;
  document: FigmaNode;
  components: Record<string, FigmaComponent>;
  styles: Record<string, FigmaStyle>;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: Array<{ type: string; color?: FigmaColor }>;
  characters?: string;
}

export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
}

export interface FigmaStyle {
  key: string;
  name: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
}

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface FigmaComment {
  id: string;
  message: string;
  user: { handle: string };
  created_at: string;
}

export interface FigmaVersion {
  id: string;
  created_at: string;
  label: string | null;
  user: { handle: string };
}

export interface FigmaProject {
  id: string;
  name: string;
}

// Client
export class FigmaClient {
  private readonly accessToken: string;
  private readonly baseUrl = 'https://api.figma.com/v1';

  constructor(config: { accessToken: string }) {
    if (!config.accessToken) {
      throw new Error('Figma access token is required');
    }

    this.accessToken = config.accessToken;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'X-Figma-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { err?: string };
      throw new Error(error.err || `Figma API error: ${response.status}`);
    }

    return response.json();
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.request('GET', '/me');
      return true;
    } catch {
      return false;
    }
  }
}

export function createFigmaClient(accessToken: string): FigmaClient {
  return new FigmaClient({ accessToken });
}

// File functions
export async function getFile(client: FigmaClient, fileKey: string, options?: { depth?: number }): Promise<FigmaFile> {
  const query = options?.depth ? `?depth=${options.depth}` : '';
  return client.request('GET', `/files/${fileKey}${query}`);
}

export async function getFileNodes(
  client: FigmaClient,
  fileKey: string,
  nodeIds: string[],
): Promise<Record<string, { document: FigmaNode }>> {
  const ids = nodeIds.join(',');
  const result = await client.request<{ nodes: Record<string, { document: FigmaNode }> }>(
    'GET',
    `/files/${fileKey}/nodes?ids=${ids}`,
  );

  return result.nodes;
}

export async function getFileComponents(client: FigmaClient, fileKey: string): Promise<FigmaComponent[]> {
  const result = await client.request<{ meta: { components: FigmaComponent[] } }>(
    'GET',
    `/files/${fileKey}/components`,
  );
  return result.meta.components;
}

export async function getFileStyles(client: FigmaClient, fileKey: string): Promise<FigmaStyle[]> {
  const result = await client.request<{ meta: { styles: FigmaStyle[] } }>('GET', `/files/${fileKey}/styles`);
  return result.meta.styles;
}

// Image functions
export async function getImages(
  client: FigmaClient,
  fileKey: string,
  nodeIds: string[],
  options?: { format?: 'jpg' | 'png' | 'svg' | 'pdf'; scale?: number },
): Promise<Record<string, string>> {
  const params = new URLSearchParams({ ids: nodeIds.join(',') });

  if (options?.format) {
    params.set('format', options.format);
  }

  if (options?.scale) {
    params.set('scale', String(options.scale));
  }

  const result = await client.request<{ images: Record<string, string> }>(
    'GET',
    `/images/${fileKey}?${params.toString()}`,
  );

  return result.images;
}

export async function getImageFills(client: FigmaClient, fileKey: string): Promise<Record<string, string>> {
  const result = await client.request<{ meta: { images: Record<string, string> } }>('GET', `/files/${fileKey}/images`);
  return result.meta.images;
}

// Comment functions
export async function getComments(client: FigmaClient, fileKey: string): Promise<FigmaComment[]> {
  const result = await client.request<{ comments: FigmaComment[] }>('GET', `/files/${fileKey}/comments`);
  return result.comments;
}

export async function postComment(
  client: FigmaClient,
  fileKey: string,
  message: string,
  nodeId?: string,
): Promise<FigmaComment> {
  const body: Record<string, unknown> = { message };

  if (nodeId) {
    body.node_id = nodeId;
  }

  return client.request('POST', `/files/${fileKey}/comments`, body);
}

// Version functions
export async function getVersions(client: FigmaClient, fileKey: string): Promise<FigmaVersion[]> {
  const result = await client.request<{ versions: FigmaVersion[] }>('GET', `/files/${fileKey}/versions`);
  return result.versions;
}

// Project functions
export async function getTeamProjects(client: FigmaClient, teamId: string): Promise<FigmaProject[]> {
  const result = await client.request<{ projects: FigmaProject[] }>('GET', `/teams/${teamId}/projects`);
  return result.projects;
}

export async function getProjectFiles(
  client: FigmaClient,
  projectId: string,
): Promise<Array<{ key: string; name: string }>> {
  const result = await client.request<{ files: Array<{ key: string; name: string }> }>(
    'GET',
    `/projects/${projectId}/files`,
  );
  return result.files;
}

// Utility functions
export function extractColors(node: FigmaNode): FigmaColor[] {
  const colors: FigmaColor[] = [];

  function traverse(n: FigmaNode): void {
    if (n.fills) {
      for (const fill of n.fills) {
        if (fill.type === 'SOLID' && fill.color) {
          colors.push(fill.color);
        }
      }
    }

    if (n.children) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }

  traverse(node);

  return colors;
}

export function extractText(node: FigmaNode): string[] {
  const texts: string[] = [];

  function traverse(n: FigmaNode): void {
    if (n.type === 'TEXT' && n.characters) {
      texts.push(n.characters);
    }

    if (n.children) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }

  traverse(node);

  return texts;
}

export function rgbaToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255)
    .toString(16)
    .padStart(2, '0');
  const g = Math.round(color.g * 255)
    .toString(16)
    .padStart(2, '0');
  const b = Math.round(color.b * 255)
    .toString(16)
    .padStart(2, '0');

  return `#${r}${g}${b}`;
}
