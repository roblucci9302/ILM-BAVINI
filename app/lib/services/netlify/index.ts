/**
 * Netlify SDK.
 *
 * Lightweight client for Netlify API.
 */

// Types
export interface NetlifySite {
  id: string;
  name: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  screenshot_url?: string;
  created_at: string;
  updated_at: string;
  published_deploy?: { id: string; state: string };
}

export interface NetlifyDeploy {
  id: string;
  site_id: string;
  state: 'uploading' | 'uploaded' | 'preparing' | 'prepared' | 'processing' | 'ready' | 'error';
  url: string;
  ssl_url: string;
  deploy_url: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  error_message?: string;
}

export interface NetlifyEnvVar {
  key: string;
  values: Array<{ value: string; context: string }>;
}

export interface CreateSiteOptions {
  name?: string;
  custom_domain?: string;
  repo?: { provider: string; repo: string; branch: string };
}

// Client
export class NetlifyClient {
  private readonly accessToken: string;
  private readonly baseUrl = 'https://api.netlify.com/api/v1';

  constructor(config: { accessToken: string }) {
    if (!config.accessToken) {
      throw new Error('Netlify access token is required');
    }

    this.accessToken = config.accessToken;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
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
      throw new Error(error.message || `Netlify API error: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.get('/user');
      return true;
    } catch {
      return false;
    }
  }
}

export function createNetlifyClient(accessToken: string): NetlifyClient {
  return new NetlifyClient({ accessToken });
}

// Site functions
export async function listSites(client: NetlifyClient): Promise<NetlifySite[]> {
  return client.get('/sites');
}

export async function getSite(client: NetlifyClient, siteId: string): Promise<NetlifySite> {
  return client.get(`/sites/${siteId}`);
}

export async function createSite(client: NetlifyClient, options?: CreateSiteOptions): Promise<NetlifySite> {
  return client.post('/sites', options);
}

export async function updateSite(
  client: NetlifyClient,
  siteId: string,
  updates: Partial<CreateSiteOptions>,
): Promise<NetlifySite> {
  return client.patch(`/sites/${siteId}`, updates);
}

export async function deleteSite(client: NetlifyClient, siteId: string): Promise<void> {
  await client.delete(`/sites/${siteId}`);
}

// Deploy functions
export async function listDeploys(client: NetlifyClient, siteId: string): Promise<NetlifyDeploy[]> {
  return client.get(`/sites/${siteId}/deploys`);
}

export async function getDeploy(client: NetlifyClient, deployId: string): Promise<NetlifyDeploy> {
  return client.get(`/deploys/${deployId}`);
}

export async function createDeploy(
  client: NetlifyClient,
  siteId: string,
  options?: { title?: string },
): Promise<NetlifyDeploy> {
  return client.post(`/sites/${siteId}/deploys`, options);
}

export async function rollbackDeploy(client: NetlifyClient, siteId: string, deployId: string): Promise<NetlifyDeploy> {
  return client.post(`/sites/${siteId}/rollback`, { deploy_id: deployId });
}

export async function cancelDeploy(client: NetlifyClient, deployId: string): Promise<void> {
  await client.post(`/deploys/${deployId}/cancel`);
}

// Environment variables
export async function getEnvVars(client: NetlifyClient, siteId: string): Promise<NetlifyEnvVar[]> {
  return client.get(`/sites/${siteId}/env`);
}

export async function setEnvVar(
  client: NetlifyClient,
  accountSlug: string,
  siteId: string,
  key: string,
  value: string,
): Promise<NetlifyEnvVar> {
  return client.post(`/accounts/${accountSlug}/env/${key}?site_id=${siteId}`, {
    key,
    values: [{ value, context: 'all' }],
  });
}

export async function deleteEnvVar(
  client: NetlifyClient,
  accountSlug: string,
  siteId: string,
  key: string,
): Promise<void> {
  await client.delete(`/accounts/${accountSlug}/env/${key}?site_id=${siteId}`);
}

// Build hooks
export async function createBuildHook(
  client: NetlifyClient,
  siteId: string,
  title: string,
  branch?: string,
): Promise<{ id: string; url: string }> {
  return client.post(`/sites/${siteId}/build_hooks`, { title, branch });
}

export async function triggerBuild(client: NetlifyClient, siteId: string): Promise<NetlifyDeploy> {
  return client.post(`/sites/${siteId}/builds`);
}
