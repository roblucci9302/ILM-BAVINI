/**
 * n8n API Types.
 *
 * Type definitions for the n8n workflow automation API.
 */

/**
 * n8n API configuration.
 */
export interface N8nConfig {
  apiKey: string;
  instanceUrl: string;
  timeout?: number;
}

/**
 * Workflow status.
 */
export type WorkflowStatus = 'active' | 'inactive';

/**
 * Execution status.
 */
export type ExecutionStatus = 'success' | 'error' | 'running' | 'waiting' | 'unknown';

/**
 * Workflow node definition.
 */
export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
}

/**
 * Workflow connection definition.
 */
export interface WorkflowConnection {
  node: string;
  type: string;
  index: number;
}

/**
 * Workflow definition.
 */
export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes?: WorkflowNode[];
  connections?: Record<string, Record<string, WorkflowConnection[][]>>;
  settings?: WorkflowSettings;
  staticData?: Record<string, unknown>;
  tags?: Tag[];
}

/**
 * Workflow settings.
 */
export interface WorkflowSettings {
  saveDataErrorExecution?: 'all' | 'none';
  saveDataSuccessExecution?: 'all' | 'none';
  saveManualExecutions?: boolean;
  saveExecutionProgress?: boolean;
  executionTimeout?: number;
  timezone?: string;
}

/**
 * Workflow list response.
 */
export interface WorkflowListResponse {
  data: Workflow[];
  nextCursor?: string;
}

/**
 * Workflow execution.
 */
export interface Execution {
  id: string;
  finished: boolean;
  mode: 'manual' | 'trigger' | 'webhook' | 'cli' | 'integrated' | 'internal';
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  status: ExecutionStatus;
  data?: ExecutionData;
  workflowData?: Workflow;
}

/**
 * Execution data.
 */
export interface ExecutionData {
  resultData?: {
    runData?: Record<string, NodeExecutionData[]>;
    error?: ExecutionError;
  };
}

/**
 * Node execution data.
 */
export interface NodeExecutionData {
  startTime: number;
  executionTime: number;
  data: {
    main: Array<Array<{ json: Record<string, unknown> }>>;
  };
  source: unknown[];
}

/**
 * Execution error.
 */
export interface ExecutionError {
  message: string;
  stack?: string;
  node?: string;
}

/**
 * Execution list response.
 */
export interface ExecutionListResponse {
  data: Execution[];
  nextCursor?: string;
}

/**
 * Tag definition.
 */
export interface Tag {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Credential definition.
 */
export interface Credential {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Credential list response.
 */
export interface CredentialListResponse {
  data: Credential[];
  nextCursor?: string;
}

/**
 * Webhook trigger options.
 */
export interface WebhookTriggerOptions {
  workflowId: string;
  webhookPath: string;
  data?: Record<string, unknown>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
}

/**
 * Webhook response.
 */
export interface WebhookResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * API error response.
 */
export interface N8nError {
  message: string;
  code?: string;
  description?: string;
}

/**
 * Workflow create/update options.
 */
export interface WorkflowCreateOptions {
  name: string;
  nodes: WorkflowNode[];
  connections: Record<string, Record<string, WorkflowConnection[][]>>;
  settings?: WorkflowSettings;
  active?: boolean;
}

/**
 * Execution filter options.
 */
export interface ExecutionFilterOptions {
  workflowId?: string;
  status?: ExecutionStatus;
  limit?: number;
  cursor?: string;
}

/**
 * Default timeout in milliseconds.
 */
export const DEFAULT_TIMEOUT = 30000;
