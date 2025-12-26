/**
 * Linear SDK.
 *
 * Lightweight client for Linear GraphQL API.
 */

// Types
export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  state: { id: string; name: string };
  assignee?: { id: string; name: string };
  team: { id: string; name: string };
  url: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearProject {
  id: string;
  name: string;
  state: string;
}

export interface LinearIssueList {
  nodes: LinearIssue[];
  pageInfo: { hasNextPage: boolean; endCursor?: string };
}

export interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

export interface CreateIssueInput {
  title: string;
  teamId: string;
  description?: string;
  priority?: number;
  assigneeId?: string;
  stateId?: string;
}

// Client
export class LinearClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.linear.app/graphql';

  constructor(config: { apiKey: string }) {
    if (!config.apiKey) {
      throw new Error('Linear API key is required');
    }

    this.apiKey = config.apiKey;
  }

  async query<T>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResponse<T>> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Linear API error: ${response.status}`);
    }

    const result = (await response.json()) as GraphQLResponse<T>;

    if (result.errors?.length) {
      throw new Error(result.errors[0].message);
    }

    return result;
  }

  async mutate<T>(mutation: string, variables?: Record<string, unknown>): Promise<GraphQLResponse<T>> {
    return this.query<T>(mutation, variables);
  }

  async validateKey(): Promise<boolean> {
    try {
      const result = await this.query<{ viewer: { id: string } }>('query { viewer { id } }');
      return !!result.data?.viewer?.id;
    } catch {
      return false;
    }
  }
}

export function createLinearClient(apiKey: string): LinearClient {
  return new LinearClient({ apiKey });
}

// Issue functions
export async function listIssues(
  client: LinearClient,
  options?: { teamId?: string; first?: number },
): Promise<LinearIssueList> {
  const filter = options?.teamId ? `filter: { team: { id: { eq: "${options.teamId}" } } }` : '';
  const first = options?.first || 50;

  const result = await client.query<{ issues: LinearIssueList }>(`
    query {
      issues(first: ${first} ${filter}) {
        nodes {
          id identifier title description priority url
          state { id name }
          assignee { id name }
          team { id name }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `);

  return result.data.issues;
}

export async function getIssue(client: LinearClient, issueId: string): Promise<LinearIssue> {
  const result = await client.query<{ issue: LinearIssue }>(`
    query {
      issue(id: "${issueId}") {
        id identifier title description priority url
        state { id name }
        assignee { id name }
        team { id name }
      }
    }
  `);

  return result.data.issue;
}

export async function createIssue(client: LinearClient, input: CreateIssueInput): Promise<LinearIssue> {
  const result = await client.mutate<{ issueCreate: { success: boolean; issue: LinearIssue } }>(
    `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id identifier title description priority url
          state { id name }
          team { id name }
        }
      }
    }
  `,
    { input },
  );

  return result.data.issueCreate.issue;
}

export async function updateIssue(
  client: LinearClient,
  issueId: string,
  updates: Partial<CreateIssueInput>,
): Promise<LinearIssue> {
  const result = await client.mutate<{ issueUpdate: { success: boolean; issue: LinearIssue } }>(
    `
    mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue {
          id identifier title description priority url
          state { id name }
          team { id name }
        }
      }
    }
  `,
    { id: issueId, input: updates },
  );

  return result.data.issueUpdate.issue;
}

export async function deleteIssue(client: LinearClient, issueId: string): Promise<boolean> {
  const result = await client.mutate<{ issueDelete: { success: boolean } }>(
    `
    mutation DeleteIssue($id: String!) {
      issueDelete(id: $id) {
        success
      }
    }
  `,
    { id: issueId },
  );

  return result.data.issueDelete.success;
}

export async function searchIssues(client: LinearClient, query: string): Promise<LinearIssueList> {
  const result = await client.query<{ issueSearch: LinearIssueList }>(
    `
    query SearchIssues($query: String!) {
      issueSearch(query: $query, first: 50) {
        nodes {
          id identifier title description priority url
          state { id name }
          team { id name }
        }
        pageInfo { hasNextPage }
      }
    }
  `,
    { query },
  );

  return result.data.issueSearch;
}

// Team functions
export async function listTeams(client: LinearClient): Promise<LinearTeam[]> {
  const result = await client.query<{ teams: { nodes: LinearTeam[] } }>(`
    query {
      teams {
        nodes { id name key }
      }
    }
  `);

  return result.data.teams.nodes;
}

// Project functions
export async function listProjects(client: LinearClient): Promise<LinearProject[]> {
  const result = await client.query<{ projects: { nodes: LinearProject[] } }>(`
    query {
      projects(first: 50) {
        nodes { id name state }
      }
    }
  `);

  return result.data.projects.nodes;
}
