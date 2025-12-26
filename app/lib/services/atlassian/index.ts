/**
 * Atlassian SDK.
 *
 * Lightweight client for Jira and Confluence APIs.
 */

// Types
export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: { name: string };
    priority?: { name: string };
    assignee?: { displayName: string };
    issuetype: { name: string };
  };
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
}

export interface JiraTransition {
  id: string;
  name: string;
}

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
}

export interface ConfluencePage {
  id: string;
  title: string;
  body?: { storage: { value: string } };
  version?: { number: number };
}

export interface CreateIssueOptions {
  projectKey: string;
  issueType: string;
  summary: string;
  description?: string;
}

export interface CreatePageOptions {
  spaceKey: string;
  title: string;
  content: string;
  parentId?: string;
}

// Client
export class AtlassianClient {
  private readonly domain: string;
  private readonly auth: string;

  constructor(config: { domain: string; email: string; apiToken: string }) {
    if (!config.domain || !config.email || !config.apiToken) {
      throw new Error('Domain, email, and API token are required');
    }

    this.domain = config.domain.replace(/\/$/, '');
    this.auth = btoa(`${config.email}:${config.apiToken}`);
  }

  async jira<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`https://${this.domain}/rest/api/3${path}`, {
      method,
      headers: {
        Authorization: `Basic ${this.auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { errorMessages?: string[] };
      throw new Error(error.errorMessages?.[0] || `Jira API error: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async confluence<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`https://${this.domain}/wiki/rest/api${path}`, {
      method,
      headers: {
        Authorization: `Basic ${this.auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { message?: string };
      throw new Error(error.message || `Confluence API error: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.jira('GET', '/myself');
      return true;
    } catch {
      return false;
    }
  }
}

export function createAtlassianClient(domain: string, email: string, apiToken: string): AtlassianClient {
  return new AtlassianClient({ domain, email, apiToken });
}

// Jira Project functions
export async function listProjects(client: AtlassianClient): Promise<JiraProject[]> {
  const result = await client.jira<{ values: JiraProject[] }>('GET', '/project/search');
  return result.values;
}

export async function getProject(client: AtlassianClient, projectKey: string): Promise<JiraProject> {
  return client.jira('GET', `/project/${projectKey}`);
}

// Jira Issue functions
export async function searchIssues(client: AtlassianClient, jql: string): Promise<JiraSearchResult> {
  return client.jira('POST', '/search', { jql, maxResults: 50 });
}

export async function getIssue(client: AtlassianClient, issueKey: string): Promise<JiraIssue> {
  return client.jira('GET', `/issue/${issueKey}`);
}

export async function createIssue(client: AtlassianClient, options: CreateIssueOptions): Promise<JiraIssue> {
  return client.jira('POST', '/issue', {
    fields: {
      project: { key: options.projectKey },
      issuetype: { name: options.issueType },
      summary: options.summary,
      description: options.description
        ? {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: options.description }] }],
          }
        : undefined,
    },
  });
}

export async function updateIssue(
  client: AtlassianClient,
  issueKey: string,
  updates: { summary?: string; description?: string },
): Promise<void> {
  const fields: Record<string, unknown> = {};

  if (updates.summary) {
    fields.summary = updates.summary;
  }

  if (updates.description) {
    fields.description = {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: updates.description }] }],
    };
  }

  await client.jira('PUT', `/issue/${issueKey}`, { fields });
}

export async function deleteIssue(client: AtlassianClient, issueKey: string): Promise<void> {
  await client.jira('DELETE', `/issue/${issueKey}`);
}

export async function getTransitions(client: AtlassianClient, issueKey: string): Promise<JiraTransition[]> {
  const result = await client.jira<{ transitions: JiraTransition[] }>('GET', `/issue/${issueKey}/transitions`);
  return result.transitions;
}

export async function transitionIssue(client: AtlassianClient, issueKey: string, transitionId: string): Promise<void> {
  await client.jira('POST', `/issue/${issueKey}/transitions`, { transition: { id: transitionId } });
}

export async function addComment(client: AtlassianClient, issueKey: string, comment: string): Promise<void> {
  await client.jira('POST', `/issue/${issueKey}/comment`, {
    body: {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }],
    },
  });
}

// Confluence Space functions
export async function listSpaces(client: AtlassianClient): Promise<ConfluenceSpace[]> {
  const result = await client.confluence<{ results: ConfluenceSpace[] }>('GET', '/space');
  return result.results;
}

export async function getSpace(client: AtlassianClient, spaceKey: string): Promise<ConfluenceSpace> {
  return client.confluence('GET', `/space/${spaceKey}`);
}

// Confluence Page functions
export async function getPage(client: AtlassianClient, pageId: string): Promise<ConfluencePage> {
  return client.confluence('GET', `/content/${pageId}?expand=body.storage,version`);
}

export async function getPageByTitle(
  client: AtlassianClient,
  spaceKey: string,
  title: string,
): Promise<ConfluencePage | null> {
  const result = await client.confluence<{ results: ConfluencePage[] }>(
    'GET',
    `/content?spaceKey=${spaceKey}&title=${encodeURIComponent(title)}`,
  );
  return result.results[0] || null;
}

export async function createPage(client: AtlassianClient, options: CreatePageOptions): Promise<ConfluencePage> {
  return client.confluence('POST', '/content', {
    type: 'page',
    title: options.title,
    space: { key: options.spaceKey },
    body: { storage: { value: options.content, representation: 'storage' } },
    ancestors: options.parentId ? [{ id: options.parentId }] : undefined,
  });
}

export async function updatePage(
  client: AtlassianClient,
  pageId: string,
  title: string,
  content: string,
  version: number,
): Promise<ConfluencePage> {
  return client.confluence('PUT', `/content/${pageId}`, {
    type: 'page',
    title,
    body: { storage: { value: content, representation: 'storage' } },
    version: { number: version + 1 },
  });
}

export async function deletePage(client: AtlassianClient, pageId: string): Promise<void> {
  await client.confluence('DELETE', `/content/${pageId}`);
}

export async function searchContent(client: AtlassianClient, cql: string): Promise<ConfluencePage[]> {
  const result = await client.confluence<{ results: ConfluencePage[] }>(
    'GET',
    `/content/search?cql=${encodeURIComponent(cql)}`,
  );
  return result.results;
}
