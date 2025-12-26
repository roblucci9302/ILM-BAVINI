/**
 * n8n SDK.
 *
 * Provides workflow automation management functionality.
 */

// Client
export { N8nClient, createN8nClient } from './client';

// Types
export type {
  N8nConfig,
  N8nError,
  WorkflowStatus,
  ExecutionStatus,
  Workflow,
  WorkflowNode,
  WorkflowConnection,
  WorkflowSettings,
  WorkflowListResponse,
  WorkflowCreateOptions,
  Execution,
  ExecutionData,
  ExecutionError,
  ExecutionListResponse,
  ExecutionFilterOptions,
  NodeExecutionData,
  Tag,
  Credential,
  CredentialListResponse,
  WebhookTriggerOptions,
  WebhookResponse,
} from './types';

export { DEFAULT_TIMEOUT } from './types';

// Workflow functions
export {
  getWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  activateWorkflow,
  deactivateWorkflow,
  executeWorkflow,
  getExecutions,
  getExecution,
  deleteExecution,
  waitForExecution,
  getTags,
  createTag,
  getCredentials,
  triggerWebhook,
  findWorkflowsByName,
  getActiveWorkflows,
  getRecentExecutions,
  getFailedExecutions,
} from './workflows';
