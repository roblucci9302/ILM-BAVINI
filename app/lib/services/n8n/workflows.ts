/**
 * n8n Workflow Functions.
 *
 * Provides workflow management and execution functionality.
 */

import type { N8nClient } from './client';
import type {
  Workflow,
  WorkflowListResponse,
  WorkflowCreateOptions,
  Execution,
  ExecutionListResponse,
  ExecutionFilterOptions,
  Tag,
  Credential,
  CredentialListResponse,
  WebhookTriggerOptions,
  WebhookResponse,
} from './types';

/*
 * ============================================================================
 * Workflow Management
 * ============================================================================
 */

/**
 * Get all workflows.
 */
export async function getWorkflows(
  client: N8nClient,
  options?: { limit?: number; cursor?: string; active?: boolean },
): Promise<WorkflowListResponse> {
  const params: Record<string, string> = {};

  if (options?.limit) {
    params.limit = options.limit.toString();
  }

  if (options?.cursor) {
    params.cursor = options.cursor;
  }

  if (options?.active !== undefined) {
    params.active = options.active.toString();
  }

  return client.get<WorkflowListResponse>('/workflows', params);
}

/**
 * Get a workflow by ID.
 */
export async function getWorkflow(client: N8nClient, workflowId: string): Promise<Workflow> {
  if (!workflowId) {
    throw new Error('Workflow ID is required');
  }

  return client.get<Workflow>(`/workflows/${workflowId}`);
}

/**
 * Create a new workflow.
 */
export async function createWorkflow(client: N8nClient, options: WorkflowCreateOptions): Promise<Workflow> {
  if (!options.name) {
    throw new Error('Workflow name is required');
  }

  return client.post<Workflow>('/workflows', options);
}

/**
 * Update a workflow.
 */
export async function updateWorkflow(
  client: N8nClient,
  workflowId: string,
  updates: Partial<WorkflowCreateOptions>,
): Promise<Workflow> {
  if (!workflowId) {
    throw new Error('Workflow ID is required');
  }

  return client.put<Workflow>(`/workflows/${workflowId}`, updates);
}

/**
 * Delete a workflow.
 */
export async function deleteWorkflow(client: N8nClient, workflowId: string): Promise<Workflow> {
  if (!workflowId) {
    throw new Error('Workflow ID is required');
  }

  return client.delete<Workflow>(`/workflows/${workflowId}`);
}

/**
 * Activate a workflow.
 */
export async function activateWorkflow(client: N8nClient, workflowId: string): Promise<Workflow> {
  return updateWorkflow(client, workflowId, { active: true });
}

/**
 * Deactivate a workflow.
 */
export async function deactivateWorkflow(client: N8nClient, workflowId: string): Promise<Workflow> {
  return updateWorkflow(client, workflowId, { active: false });
}

/*
 * ============================================================================
 * Workflow Execution
 * ============================================================================
 */

/**
 * Execute a workflow manually.
 */
export async function executeWorkflow(
  client: N8nClient,
  workflowId: string,
  data?: Record<string, unknown>,
): Promise<Execution> {
  if (!workflowId) {
    throw new Error('Workflow ID is required');
  }

  const body: Record<string, unknown> = {};

  if (data) {
    body.data = data;
  }

  return client.post<Execution>(`/workflows/${workflowId}/run`, body);
}

/**
 * Get all executions.
 */
export async function getExecutions(
  client: N8nClient,
  options?: ExecutionFilterOptions,
): Promise<ExecutionListResponse> {
  const params: Record<string, string> = {};

  if (options?.workflowId) {
    params.workflowId = options.workflowId;
  }

  if (options?.status) {
    params.status = options.status;
  }

  if (options?.limit) {
    params.limit = options.limit.toString();
  }

  if (options?.cursor) {
    params.cursor = options.cursor;
  }

  return client.get<ExecutionListResponse>('/executions', params);
}

/**
 * Get an execution by ID.
 */
export async function getExecution(client: N8nClient, executionId: string): Promise<Execution> {
  if (!executionId) {
    throw new Error('Execution ID is required');
  }

  return client.get<Execution>(`/executions/${executionId}`);
}

/**
 * Delete an execution.
 */
export async function deleteExecution(client: N8nClient, executionId: string): Promise<Execution> {
  if (!executionId) {
    throw new Error('Execution ID is required');
  }

  return client.delete<Execution>(`/executions/${executionId}`);
}

/**
 * Wait for an execution to complete.
 */
export async function waitForExecution(
  client: N8nClient,
  executionId: string,
  pollInterval: number = 1000,
  maxWait: number = 60000,
): Promise<Execution> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const execution = await getExecution(client, executionId);

    if (execution.finished) {
      return execution;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Execution timed out');
}

/*
 * ============================================================================
 * Tags
 * ============================================================================
 */

/**
 * Get all tags.
 */
export async function getTags(client: N8nClient): Promise<{ data: Tag[] }> {
  return client.get<{ data: Tag[] }>('/tags');
}

/**
 * Create a tag.
 */
export async function createTag(client: N8nClient, name: string): Promise<Tag> {
  if (!name) {
    throw new Error('Tag name is required');
  }

  return client.post<Tag>('/tags', { name });
}

/*
 * ============================================================================
 * Credentials
 * ============================================================================
 */

/**
 * Get all credentials (metadata only).
 */
export async function getCredentials(
  client: N8nClient,
  options?: { limit?: number; cursor?: string },
): Promise<CredentialListResponse> {
  const params: Record<string, string> = {};

  if (options?.limit) {
    params.limit = options.limit.toString();
  }

  if (options?.cursor) {
    params.cursor = options.cursor;
  }

  return client.get<CredentialListResponse>('/credentials', params);
}

/*
 * ============================================================================
 * Webhooks
 * ============================================================================
 */

/**
 * Trigger a workflow via webhook.
 */
export async function triggerWebhook(client: N8nClient, options: WebhookTriggerOptions): Promise<WebhookResponse> {
  const { webhookPath, data, method = 'POST' } = options;

  if (!webhookPath) {
    throw new Error('Webhook path is required');
  }

  const webhookUrl = `${client.getWebhookBaseUrl()}/${webhookPath.replace(/^\//, '')}`;

  try {
    const response = await fetch(webhookUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Webhook returned ${response.status}`,
      };
    }

    const responseData = await response.json().catch(() => null);

    return {
      success: true,
      data: responseData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Webhook request failed',
    };
  }
}

/*
 * ============================================================================
 * Helpers
 * ============================================================================
 */

/**
 * Find workflows by name.
 */
export async function findWorkflowsByName(client: N8nClient, name: string): Promise<Workflow[]> {
  const response = await getWorkflows(client);
  const lowerName = name.toLowerCase();

  return response.data.filter((w) => w.name.toLowerCase().includes(lowerName));
}

/**
 * Get active workflows only.
 */
export async function getActiveWorkflows(client: N8nClient): Promise<Workflow[]> {
  const response = await getWorkflows(client, { active: true });

  return response.data;
}

/**
 * Get recent executions for a workflow.
 */
export async function getRecentExecutions(
  client: N8nClient,
  workflowId: string,
  limit: number = 10,
): Promise<Execution[]> {
  const response = await getExecutions(client, { workflowId, limit });

  return response.data;
}

/**
 * Get failed executions.
 */
export async function getFailedExecutions(client: N8nClient, limit: number = 10): Promise<Execution[]> {
  const response = await getExecutions(client, { status: 'error', limit });

  return response.data;
}
