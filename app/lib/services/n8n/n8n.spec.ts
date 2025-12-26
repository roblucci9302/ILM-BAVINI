/**
 * n8n SDK Tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { N8nClient, createN8nClient } from './client';
import {
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
  getTags,
  createTag,
  findWorkflowsByName,
} from './workflows';
import type { Workflow, WorkflowListResponse, Execution, ExecutionListResponse, Tag } from './types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const TEST_INSTANCE_URL = 'https://n8n.example.com';

describe('N8nClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with API key and instance URL', () => {
      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      expect(client).toBeInstanceOf(N8nClient);
    });

    it('should throw error without API key', () => {
      expect(() => new N8nClient({ apiKey: '', instanceUrl: TEST_INSTANCE_URL })).toThrow('n8n API key is required');
    });

    it('should throw error without instance URL', () => {
      expect(() => new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: '' })).toThrow('n8n instance URL is required');
    });

    it('should normalize trailing slash in instance URL', () => {
      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: `${TEST_INSTANCE_URL}/` });
      expect(client.getWebhookBaseUrl()).toBe(`${TEST_INSTANCE_URL}/webhook`);
    });
  });

  describe('createN8nClient', () => {
    it('should create client instance', () => {
      const client = createN8nClient(TEST_INSTANCE_URL, 'n8n-test-key');
      expect(client).toBeInstanceOf(N8nClient);
    });
  });

  describe('get', () => {
    it('should make authenticated GET request', async () => {
      const mockResponse = { data: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await client.get('/workflows');

      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_INSTANCE_URL}/api/v1/workflows`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-N8N-API-KEY': 'n8n-test-key',
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should include query params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      await client.get('/workflows', { limit: '10', active: 'true' });

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('limit=10'), expect.any(Object));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('active=true'), expect.any(Object));
    });
  });

  describe('post', () => {
    it('should make authenticated POST request with JSON body', async () => {
      const mockResponse = { id: '1', name: 'Test Workflow' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await client.post('/workflows', { name: 'Test Workflow' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_INSTANCE_URL}/api/v1/workflows`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-N8N-API-KEY': 'n8n-test-key',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ name: 'Test Workflow' }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await client.validateApiKey();

      expect(result).toBe(true);
    });

    it('should return false for invalid key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Invalid API key' }),
      });

      const client = new N8nClient({ apiKey: 'n8n-invalid', instanceUrl: TEST_INSTANCE_URL });
      const result = await client.validateApiKey();

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw for 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      await expect(client.get('/workflows')).rejects.toThrow('Invalid n8n API key');
    });

    it('should throw for 403 forbidden', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      await expect(client.get('/workflows')).rejects.toThrow('n8n API access forbidden');
    });

    it('should throw for 404 not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      await expect(client.get('/workflows/999')).rejects.toThrow('n8n resource not found');
    });

    it('should throw for 429 rate limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      await expect(client.get('/workflows')).rejects.toThrow('n8n rate limit exceeded');
    });
  });

  describe('getWebhookBaseUrl', () => {
    it('should return webhook base URL', () => {
      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      expect(client.getWebhookBaseUrl()).toBe(`${TEST_INSTANCE_URL}/webhook`);
    });
  });
});

describe('Workflow Functions', () => {
  const mockWorkflow: Workflow = {
    id: '1',
    name: 'Test Workflow',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('getWorkflows', () => {
    it('should get all workflows', async () => {
      const mockResponse: WorkflowListResponse = { data: [mockWorkflow] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await getWorkflows(client);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Test Workflow');
    });
  });

  describe('getWorkflow', () => {
    it('should get workflow by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorkflow),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await getWorkflow(client, '1');

      expect(result.id).toBe('1');
      expect(result.name).toBe('Test Workflow');
    });

    it('should throw for missing workflow ID', async () => {
      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      await expect(getWorkflow(client, '')).rejects.toThrow('Workflow ID is required');
    });
  });

  describe('createWorkflow', () => {
    it('should create a workflow', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorkflow),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await createWorkflow(client, {
        name: 'Test Workflow',
        nodes: [],
        connections: {},
      });

      expect(result.name).toBe('Test Workflow');
    });

    it('should throw for missing name', async () => {
      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      await expect(createWorkflow(client, { name: '', nodes: [], connections: {} })).rejects.toThrow(
        'Workflow name is required',
      );
    });
  });

  describe('updateWorkflow', () => {
    it('should update a workflow', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockWorkflow, name: 'Updated Workflow' }),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await updateWorkflow(client, '1', { name: 'Updated Workflow' });

      expect(result.name).toBe('Updated Workflow');
    });

    it('should throw for missing workflow ID', async () => {
      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      await expect(updateWorkflow(client, '', { name: 'Test' })).rejects.toThrow('Workflow ID is required');
    });
  });

  describe('deleteWorkflow', () => {
    it('should delete a workflow', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWorkflow),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await deleteWorkflow(client, '1');

      expect(result.id).toBe('1');
    });

    it('should throw for missing workflow ID', async () => {
      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      await expect(deleteWorkflow(client, '')).rejects.toThrow('Workflow ID is required');
    });
  });

  describe('activateWorkflow', () => {
    it('should activate a workflow', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockWorkflow, active: true }),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await activateWorkflow(client, '1');

      expect(result.active).toBe(true);
    });
  });

  describe('deactivateWorkflow', () => {
    it('should deactivate a workflow', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockWorkflow, active: false }),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await deactivateWorkflow(client, '1');

      expect(result.active).toBe(false);
    });
  });

  describe('executeWorkflow', () => {
    it('should execute a workflow', async () => {
      const mockExecution: Execution = {
        id: 'exec-1',
        finished: false,
        mode: 'manual',
        startedAt: '2024-01-01T00:00:00Z',
        workflowId: '1',
        status: 'running',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockExecution),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await executeWorkflow(client, '1', { input: 'test' });

      expect(result.id).toBe('exec-1');
      expect(result.status).toBe('running');
    });

    it('should throw for missing workflow ID', async () => {
      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      await expect(executeWorkflow(client, '')).rejects.toThrow('Workflow ID is required');
    });
  });

  describe('getExecutions', () => {
    it('should get all executions', async () => {
      const mockResponse: ExecutionListResponse = {
        data: [
          {
            id: 'exec-1',
            finished: true,
            mode: 'manual',
            startedAt: '2024-01-01T00:00:00Z',
            workflowId: '1',
            status: 'success',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await getExecutions(client);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('success');
    });
  });

  describe('getExecution', () => {
    it('should get execution by ID', async () => {
      const mockExecution: Execution = {
        id: 'exec-1',
        finished: true,
        mode: 'manual',
        startedAt: '2024-01-01T00:00:00Z',
        workflowId: '1',
        status: 'success',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockExecution),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await getExecution(client, 'exec-1');

      expect(result.id).toBe('exec-1');
    });

    it('should throw for missing execution ID', async () => {
      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      await expect(getExecution(client, '')).rejects.toThrow('Execution ID is required');
    });
  });

  describe('getTags', () => {
    it('should get all tags', async () => {
      const mockTags: { data: Tag[] } = {
        data: [{ id: '1', name: 'production' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTags),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await getTags(client);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('production');
    });
  });

  describe('createTag', () => {
    it('should create a tag', async () => {
      const mockTag: Tag = { id: '1', name: 'new-tag' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTag),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await createTag(client, 'new-tag');

      expect(result.name).toBe('new-tag');
    });

    it('should throw for missing tag name', async () => {
      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      await expect(createTag(client, '')).rejects.toThrow('Tag name is required');
    });
  });

  describe('findWorkflowsByName', () => {
    it('should find workflows by name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { id: '1', name: 'Test Workflow', active: true, createdAt: '', updatedAt: '' },
              { id: '2', name: 'Another Flow', active: false, createdAt: '', updatedAt: '' },
              { id: '3', name: 'Test Flow 2', active: true, createdAt: '', updatedAt: '' },
            ],
          }),
      });

      const client = new N8nClient({ apiKey: 'n8n-test-key', instanceUrl: TEST_INSTANCE_URL });
      const result = await findWorkflowsByName(client, 'test');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Test Workflow');
      expect(result[1].name).toBe('Test Flow 2');
    });
  });
});
