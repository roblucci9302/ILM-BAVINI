import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateConnector, hasValidator } from './validators';

describe('validators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hasValidator', () => {
    it('should return true for connectors with validators', () => {
      expect(hasValidator('github')).toBe(true);
      expect(hasValidator('supabase')).toBe(true);
      expect(hasValidator('stripe')).toBe(true);
      expect(hasValidator('notion')).toBe(true);
      expect(hasValidator('linear')).toBe(true);
      expect(hasValidator('netlify')).toBe(true);
      expect(hasValidator('figma')).toBe(true);
      expect(hasValidator('elevenlabs')).toBe(true);
      expect(hasValidator('firecrawl')).toBe(true);
      expect(hasValidator('perplexity')).toBe(true);
      expect(hasValidator('n8n')).toBe(true);
    });

    it('should return false for connectors without validators', () => {
      expect(hasValidator('shopify')).toBe(false);
      expect(hasValidator('atlassian')).toBe(false);
      expect(hasValidator('miro')).toBe(false);
    });
  });

  describe('validateConnector - GitHub', () => {
    it('should return error when token is missing', async () => {
      const result = await validateConnector('github', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token requis');
    });

    it('should return success on valid token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'testuser', name: 'Test User' }),
      } as Response);

      const result = await validateConnector('github', { token: 'ghp_valid_token' });

      expect(result.success).toBe(true);
      expect(result.details).toEqual({ login: 'testuser', name: 'Test User' });
    });

    it('should return error on 401', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await validateConnector('github', { token: 'invalid_token' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token invalide ou expiré');
    });

    it('should return error on network failure', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const result = await validateConnector('github', { token: 'ghp_token' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Impossible de contacter GitHub');
    });
  });

  describe('validateConnector - Supabase', () => {
    it('should return error when url is missing', async () => {
      const result = await validateConnector('supabase', { anonKey: 'key' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('URL et clé anon requis');
    });

    it('should return error when anonKey is missing', async () => {
      const result = await validateConnector('supabase', { url: 'https://test.supabase.co' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('URL et clé anon requis');
    });

    it('should return success on valid credentials', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
      } as Response);

      const result = await validateConnector('supabase', {
        url: 'https://test.supabase.co',
        anonKey: 'valid_key',
      });

      expect(result.success).toBe(true);
    });

    it('should return error on 401', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await validateConnector('supabase', {
        url: 'https://test.supabase.co',
        anonKey: 'invalid_key',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clé API invalide');
    });
  });

  describe('validateConnector - Stripe', () => {
    it('should return error when secretKey is missing', async () => {
      const result = await validateConnector('stripe', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clé secrète requise');
    });

    it('should return success on valid key', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'acct_123', email: 'test@example.com' }),
      } as Response);

      const result = await validateConnector('stripe', { secretKey: 'sk_test_valid' });

      expect(result.success).toBe(true);
      expect(result.details).toEqual({ id: 'acct_123', email: 'test@example.com' });
    });
  });

  describe('validateConnector - Notion', () => {
    it('should return error when integrationToken is missing', async () => {
      const result = await validateConnector('notion', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Token d'intégration requis");
    });

    it('should return success on valid token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test Bot', type: 'bot' }),
      } as Response);

      const result = await validateConnector('notion', { integrationToken: 'secret_valid' });

      expect(result.success).toBe(true);
      expect(result.details).toEqual({ name: 'Test Bot', type: 'bot' });
    });
  });

  describe('validateConnector - Linear', () => {
    it('should return error when apiKey is missing', async () => {
      const result = await validateConnector('linear', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clé API requise');
    });

    it('should return success on valid key', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { viewer: { name: 'Test User', email: 'test@example.com' } },
        }),
      } as Response);

      const result = await validateConnector('linear', { apiKey: 'lin_api_valid' });

      expect(result.success).toBe(true);
      expect(result.details).toEqual({ name: 'Test User', email: 'test@example.com' });
    });

    it('should return error on GraphQL errors', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errors: [{ message: 'Invalid API key' }],
        }),
      } as Response);

      const result = await validateConnector('linear', { apiKey: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });
  });

  describe('validateConnector - generic', () => {
    it('should return success for connectors without validators when credentials provided', async () => {
      const result = await validateConnector('shopify', {
        storeDomain: 'test.myshopify.com',
        accessToken: 'token',
      });

      expect(result.success).toBe(true);
    });

    it('should return error for connectors without validators when no credentials', async () => {
      const result = await validateConnector('shopify', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Credentials requis');
    });

    it('should return error when only whitespace credentials', async () => {
      const result = await validateConnector('shopify', { storeDomain: '   ', accessToken: '' });

      expect(result.success).toBe(false);
    });
  });

  describe('validateConnector - Netlify', () => {
    it('should return error when accessToken is missing', async () => {
      const result = await validateConnector('netlify', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Token d'accès requis");
    });

    it('should return success on valid token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'test@example.com', full_name: 'Test User' }),
      } as Response);

      const result = await validateConnector('netlify', { accessToken: 'valid_token' });

      expect(result.success).toBe(true);
      expect(result.details).toEqual({ email: 'test@example.com', full_name: 'Test User' });
    });
  });

  describe('validateConnector - Figma', () => {
    it('should return error when accessToken is missing', async () => {
      const result = await validateConnector('figma', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Token d'accès requis");
    });

    it('should return success on valid token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'test@example.com', handle: 'testuser' }),
      } as Response);

      const result = await validateConnector('figma', { accessToken: 'valid_token' });

      expect(result.success).toBe(true);
      expect(result.details).toEqual({ email: 'test@example.com', handle: 'testuser' });
    });

    it('should return error on 403', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

      const result = await validateConnector('figma', { accessToken: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token invalide');
    });
  });

  describe('validateConnector - ElevenLabs', () => {
    it('should return error when apiKey is missing', async () => {
      const result = await validateConnector('elevenlabs', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clé API requise');
    });

    it('should return success on valid key', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subscription: { tier: 'free' } }),
      } as Response);

      const result = await validateConnector('elevenlabs', { apiKey: 'valid_key' });

      expect(result.success).toBe(true);
      expect(result.details).toEqual({ subscription: 'free' });
    });
  });

  describe('validateConnector - Firecrawl', () => {
    it('should return error when apiKey is missing', async () => {
      const result = await validateConnector('firecrawl', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clé API requise');
    });

    it('should return error on invalid key format', async () => {
      const result = await validateConnector('firecrawl', { apiKey: 'invalid_key' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Format de clé invalide (doit commencer par fc-)');
    });

    it('should return success on valid key', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await validateConnector('firecrawl', { apiKey: 'fc-valid-key-123' });

      expect(result.success).toBe(true);
      expect(result.details).toEqual({ validated: true });
    });

    it('should return error on 401', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await validateConnector('firecrawl', { apiKey: 'fc-invalid-key' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clé API invalide');
    });

    it('should return error on 402 (quota)', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 402,
      } as Response);

      const result = await validateConnector('firecrawl', { apiKey: 'fc-quota-exceeded' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Quota API épuisé');
    });

    it('should return error on network failure', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const result = await validateConnector('firecrawl', { apiKey: 'fc-valid-key' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Impossible de contacter Firecrawl');
    });
  });

  describe('validateConnector - Perplexity', () => {
    it('should return error when apiKey is missing', async () => {
      const result = await validateConnector('perplexity', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clé API requise');
    });

    it('should return error on invalid key format', async () => {
      const result = await validateConnector('perplexity', { apiKey: 'invalid_key' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Format de clé invalide (doit commencer par pplx-)');
    });

    it('should return success on valid key', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'chat-123', model: 'sonar', choices: [] }),
      } as Response);

      const result = await validateConnector('perplexity', { apiKey: 'pplx-validkey123' });

      expect(result.success).toBe(true);
      expect(result.details).toEqual({ model: 'sonar' });
    });

    it('should return error on 401', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await validateConnector('perplexity', { apiKey: 'pplx-invalidkey' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clé API invalide');
    });

    it('should return error on 429 (rate limit)', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
      } as Response);

      const result = await validateConnector('perplexity', { apiKey: 'pplx-ratelimited' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Limite de requêtes atteinte');
    });

    it('should return error on API error response', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: { message: 'Invalid model' } }),
      } as Response);

      const result = await validateConnector('perplexity', { apiKey: 'pplx-validformat' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid model');
    });

    it('should return error on network failure', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const result = await validateConnector('perplexity', { apiKey: 'pplx-validkey' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Impossible de contacter Perplexity');
    });
  });

  describe('validateConnector - n8n', () => {
    it('should return error when instanceUrl is missing', async () => {
      const result = await validateConnector('n8n', { apiKey: 'n8n_api_key' });

      expect(result.success).toBe(false);
      expect(result.error).toBe("URL de l'instance requise");
    });

    it('should return error when apiKey is missing', async () => {
      const result = await validateConnector('n8n', { instanceUrl: 'https://n8n.example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clé API requise');
    });

    it('should return success on valid credentials', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: '1', name: 'Workflow 1' },
            { id: '2', name: 'Workflow 2' },
          ],
        }),
      } as Response);

      const result = await validateConnector('n8n', {
        instanceUrl: 'https://n8n.example.com',
        apiKey: 'n8n_api_validkey',
      });

      expect(result.success).toBe(true);
      expect(result.details).toEqual({ workflowCount: 2 });
    });

    it('should normalize URL with trailing slash', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

      await validateConnector('n8n', {
        instanceUrl: 'https://n8n.example.com/',
        apiKey: 'n8n_api_key',
      });

      expect(fetchSpy).toHaveBeenCalledWith('https://n8n.example.com/api/v1/workflows', expect.any(Object));
    });

    it('should return error on 401', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await validateConnector('n8n', {
        instanceUrl: 'https://n8n.example.com',
        apiKey: 'invalid_key',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clé API invalide');
    });

    it('should return error on 404', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await validateConnector('n8n', {
        instanceUrl: 'https://wrong-url.example.com',
        apiKey: 'n8n_api_key',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('URL invalide ou API non accessible');
    });

    it('should return error on network failure', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const result = await validateConnector('n8n', {
        instanceUrl: 'https://n8n.example.com',
        apiKey: 'n8n_api_key',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Impossible de contacter n8n');
    });
  });
});
