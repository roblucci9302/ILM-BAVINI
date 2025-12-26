import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OAUTH_PROVIDER_IDS,
  supportsOAuth,
  getProviderConfig,
  getProviderUser,
  verifyProviderToken,
  PROVIDER_DISPLAY_INFO,
  type OAuthProviderId,
} from './index';
import { createGitHubProvider, getGitHubUser, verifyGitHubToken, DEFAULT_GITHUB_SCOPES } from './github';
import { createFigmaProvider, getFigmaUser, verifyFigmaToken } from './figma';
import { createNotionProvider, verifyNotionToken, parseNotionUser, type NotionTokenResponse } from './notion';
import { createLinearProvider, getLinearUser, verifyLinearToken, DEFAULT_LINEAR_SCOPES } from './linear';
import { createNetlifyProvider, getNetlifyUser, verifyNetlifyToken } from './netlify';
import { createMiroProvider, getMiroUser, verifyMiroToken, DEFAULT_MIRO_SCOPES } from './miro';
import { createSupabaseProvider, verifySupabaseToken, DEFAULT_SUPABASE_SCOPES } from './supabase';
import { createAtlassianProvider, getAtlassianUser, verifyAtlassianToken, DEFAULT_ATLASSIAN_SCOPES } from './atlassian';
import { createShopifyProvider, verifyShopifyToken, DEFAULT_SHOPIFY_SCOPES } from './shopify';

describe('OAuth Providers Registry', () => {
  describe('OAUTH_PROVIDER_IDS', () => {
    it('should include all supported providers', () => {
      expect(OAUTH_PROVIDER_IDS).toContain('github');
      expect(OAUTH_PROVIDER_IDS).toContain('figma');
      expect(OAUTH_PROVIDER_IDS).toContain('notion');
      expect(OAUTH_PROVIDER_IDS).toContain('linear');
      expect(OAUTH_PROVIDER_IDS).toContain('netlify');
      expect(OAUTH_PROVIDER_IDS).toContain('miro');
      expect(OAUTH_PROVIDER_IDS).toContain('supabase');
      expect(OAUTH_PROVIDER_IDS).toContain('atlassian');
      expect(OAUTH_PROVIDER_IDS).toContain('shopify');
    });

    it('should be a constant tuple with 9 providers', () => {
      expect(Array.isArray(OAUTH_PROVIDER_IDS)).toBe(true);
      expect(OAUTH_PROVIDER_IDS.length).toBe(9);
    });
  });

  describe('supportsOAuth', () => {
    it('should return true for supported providers', () => {
      expect(supportsOAuth('github')).toBe(true);
      expect(supportsOAuth('figma')).toBe(true);
      expect(supportsOAuth('notion')).toBe(true);
      expect(supportsOAuth('linear')).toBe(true);
      expect(supportsOAuth('netlify')).toBe(true);
      expect(supportsOAuth('miro')).toBe(true);
      expect(supportsOAuth('supabase')).toBe(true);
      expect(supportsOAuth('atlassian')).toBe(true);
      expect(supportsOAuth('shopify')).toBe(true);
    });

    it('should return false for unsupported providers', () => {
      expect(supportsOAuth('stripe')).toBe(false);
      expect(supportsOAuth('elevenlabs')).toBe(false);
      expect(supportsOAuth('perplexity')).toBe(false);
      expect(supportsOAuth('firecrawl')).toBe(false);
      expect(supportsOAuth('n8n')).toBe(false);
      expect(supportsOAuth('unknown')).toBe(false);
    });

    it('should act as type guard', () => {
      const id = 'github';

      if (supportsOAuth(id)) {
        const providerId: OAuthProviderId = id;

        expect(providerId).toBe('github');
      }
    });
  });

  describe('PROVIDER_DISPLAY_INFO', () => {
    it('should have info for all providers', () => {
      for (const id of OAUTH_PROVIDER_IDS) {
        expect(PROVIDER_DISPLAY_INFO[id]).toBeDefined();
        expect(PROVIDER_DISPLAY_INFO[id].name).toBeTruthy();
        expect(PROVIDER_DISPLAY_INFO[id].icon).toBeTruthy();
        expect(PROVIDER_DISPLAY_INFO[id].description).toBeTruthy();
      }
    });

    it('should have valid icon classes', () => {
      for (const id of OAUTH_PROVIDER_IDS) {
        expect(PROVIDER_DISPLAY_INFO[id].icon).toMatch(/^i-ph:/);
      }
    });

    it('should have correct provider names', () => {
      expect(PROVIDER_DISPLAY_INFO.github.name).toBe('GitHub');
      expect(PROVIDER_DISPLAY_INFO.figma.name).toBe('Figma');
      expect(PROVIDER_DISPLAY_INFO.notion.name).toBe('Notion');
      expect(PROVIDER_DISPLAY_INFO.linear.name).toBe('Linear');
      expect(PROVIDER_DISPLAY_INFO.netlify.name).toBe('Netlify');
      expect(PROVIDER_DISPLAY_INFO.miro.name).toBe('Miro');
      expect(PROVIDER_DISPLAY_INFO.supabase.name).toBe('Supabase');
      expect(PROVIDER_DISPLAY_INFO.atlassian.name).toBe('Atlassian');
      expect(PROVIDER_DISPLAY_INFO.shopify.name).toBe('Shopify');
    });
  });

  describe('getProviderConfig', () => {
    it('should return null when client ID is missing', () => {
      const config = getProviderConfig('github', {});

      expect(config).toBeNull();
    });

    it('should return config when client ID is provided', () => {
      const config = getProviderConfig('github', {
        GITHUB_CLIENT_ID: 'test_client_id',
      });

      expect(config).not.toBeNull();
      expect(config?.id).toBe('github');
      expect(config?.clientId).toBe('test_client_id');
    });

    it('should include client secret when provided', () => {
      const config = getProviderConfig('github', {
        GITHUB_CLIENT_ID: 'client_id',
        GITHUB_CLIENT_SECRET: 'client_secret',
      });

      expect(config?.clientSecret).toBe('client_secret');
    });

    it('should return correct config for each provider', () => {
      const githubConfig = getProviderConfig('github', { GITHUB_CLIENT_ID: 'gh_id' });
      const figmaConfig = getProviderConfig('figma', { FIGMA_CLIENT_ID: 'figma_id' });
      const notionConfig = getProviderConfig('notion', { NOTION_CLIENT_ID: 'notion_id' });
      const linearConfig = getProviderConfig('linear', { LINEAR_CLIENT_ID: 'linear_id' });
      const netlifyConfig = getProviderConfig('netlify', { NETLIFY_CLIENT_ID: 'netlify_id' });
      const miroConfig = getProviderConfig('miro', { MIRO_CLIENT_ID: 'miro_id' });
      const supabaseConfig = getProviderConfig('supabase', { SUPABASE_CLIENT_ID: 'supabase_id' });
      const atlassianConfig = getProviderConfig('atlassian', { ATLASSIAN_CLIENT_ID: 'atlassian_id' });
      const shopifyConfig = getProviderConfig('shopify', { SHOPIFY_CLIENT_ID: 'shopify_id' });

      expect(githubConfig?.name).toBe('GitHub');
      expect(figmaConfig?.name).toBe('Figma');
      expect(notionConfig?.name).toBe('Notion');
      expect(linearConfig?.name).toBe('Linear');
      expect(netlifyConfig?.name).toBe('Netlify');
      expect(miroConfig?.name).toBe('Miro');
      expect(supabaseConfig?.name).toBe('Supabase');
      expect(atlassianConfig?.name).toBe('Atlassian');
      expect(shopifyConfig?.name).toBe('Shopify');
    });
  });
});

describe('GitHub Provider', () => {
  describe('createGitHubProvider', () => {
    it('should create provider with correct URLs', () => {
      const provider = createGitHubProvider('client_id', 'client_secret');

      expect(provider.authorizationUrl).toBe('https://github.com/login/oauth/authorize');
      expect(provider.tokenUrl).toBe('https://github.com/login/oauth/access_token');
    });

    it('should set usePKCE to false', () => {
      const provider = createGitHubProvider('client_id');

      expect(provider.usePKCE).toBe(false);
    });

    it('should include default scopes', () => {
      const provider = createGitHubProvider('client_id');

      expect(provider.scopes).toEqual(DEFAULT_GITHUB_SCOPES);
      expect(provider.scopes).toContain('repo');
      expect(provider.scopes).toContain('read:user');
    });
  });

  describe('getGitHubUser', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch user info with correct headers', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 123,
          login: 'testuser',
          name: 'Test User',
          avatar_url: 'https://avatar.url',
        }),
      } as Response);

      await getGitHubUser('test_token');

      expect(fetch).toHaveBeenCalledWith('https://api.github.com/user', {
        headers: {
          Authorization: 'Bearer test_token',
          Accept: 'application/vnd.github.v3+json',
        },
      });
    });

    it('should throw on API error', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as Response);

      await expect(getGitHubUser('invalid_token')).rejects.toThrow('Failed to fetch GitHub user');
    });
  });

  describe('verifyGitHubToken', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should return true for valid token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
      } as Response);

      const result = await verifyGitHubToken('valid_token');

      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
      } as Response);

      const result = await verifyGitHubToken('invalid_token');

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await verifyGitHubToken('any_token');

      expect(result).toBe(false);
    });
  });
});

describe('Figma Provider', () => {
  describe('createFigmaProvider', () => {
    it('should create provider with correct URLs', () => {
      const provider = createFigmaProvider('client_id', 'client_secret');

      expect(provider.authorizationUrl).toBe('https://www.figma.com/oauth');
      expect(provider.tokenUrl).toBe('https://www.figma.com/api/oauth/token');
    });

    it('should set usePKCE to false', () => {
      const provider = createFigmaProvider('client_id');

      expect(provider.usePKCE).toBe(false);
    });

    it('should include file_read scope', () => {
      const provider = createFigmaProvider('client_id');

      expect(provider.scopes).toContain('file_read');
    });
  });

  describe('getFigmaUser', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch user info', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'user123',
          email: 'test@figma.com',
          handle: 'testuser',
          img_url: 'https://img.url',
        }),
      } as Response);

      const user = await getFigmaUser('test_token');

      expect(user.id).toBe('user123');
      expect(user.email).toBe('test@figma.com');
    });

    it('should call correct endpoint', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await getFigmaUser('token');

      expect(fetch).toHaveBeenCalledWith('https://api.figma.com/v1/me', {
        headers: {
          Authorization: 'Bearer token',
        },
      });
    });
  });

  describe('verifyFigmaToken', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should return true for valid token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);

      expect(await verifyFigmaToken('valid')).toBe(true);
    });

    it('should return false for invalid token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);

      expect(await verifyFigmaToken('invalid')).toBe(false);
    });
  });
});

describe('Notion Provider', () => {
  describe('createNotionProvider', () => {
    it('should create provider with correct URLs', () => {
      const provider = createNotionProvider('client_id', 'client_secret');

      expect(provider.authorizationUrl).toBe('https://api.notion.com/v1/oauth/authorize');
      expect(provider.tokenUrl).toBe('https://api.notion.com/v1/oauth/token');
    });

    it('should set usePKCE to false', () => {
      const provider = createNotionProvider('client_id');

      expect(provider.usePKCE).toBe(false);
    });

    it('should have empty scopes', () => {
      const provider = createNotionProvider('client_id');

      expect(provider.scopes).toEqual([]);
    });
  });

  describe('parseNotionUser', () => {
    it('should parse user from token response', () => {
      const tokenResponse: NotionTokenResponse = {
        access_token: 'token',
        token_type: 'Bearer',
        bot_id: 'bot123',
        workspace_id: 'ws123',
        workspace_name: 'My Workspace',
        workspace_icon: 'https://icon.url',
        owner: {
          type: 'user',
          user: {
            id: 'user123',
            name: 'Test User',
            avatar_url: 'https://avatar.url',
            type: 'person',
            person: {
              email: 'test@notion.com',
            },
          },
        },
        duplicated_template_id: null,
      };

      const user = parseNotionUser(tokenResponse);

      expect(user.id).toBe('user123');
      expect(user.name).toBe('Test User');
      expect(user.email).toBe('test@notion.com');
      expect(user.workspace_id).toBe('ws123');
    });

    it('should handle workspace owner type', () => {
      const tokenResponse: NotionTokenResponse = {
        access_token: 'token',
        token_type: 'Bearer',
        bot_id: 'bot123',
        workspace_id: 'ws123',
        workspace_name: 'Workspace Name',
        workspace_icon: null,
        owner: {
          type: 'workspace',
        },
        duplicated_template_id: null,
      };

      const user = parseNotionUser(tokenResponse);

      expect(user.id).toBe('bot123');
      expect(user.name).toBe('Workspace Name');
    });
  });

  describe('verifyNotionToken', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should call correct endpoint with Notion-Version header', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);

      await verifyNotionToken('token');

      expect(fetch).toHaveBeenCalledWith('https://api.notion.com/v1/users/me', {
        headers: {
          Authorization: 'Bearer token',
          'Notion-Version': '2022-06-28',
        },
      });
    });

    it('should return true for valid token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);

      expect(await verifyNotionToken('valid')).toBe(true);
    });

    it('should return false for invalid token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);

      expect(await verifyNotionToken('invalid')).toBe(false);
    });
  });
});

describe('Provider User Fetching', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch GitHub user through getProviderUser', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        login: 'ghuser',
        name: 'GH User',
        avatar_url: 'https://gh.avatar',
      }),
    } as Response);

    const user = await getProviderUser('github', 'token');

    expect(user).toHaveProperty('login', 'ghuser');
  });

  it('should fetch Figma user through getProviderUser', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'figma123',
        handle: 'figmauser',
        email: 'figma@example.com',
        img_url: 'https://figma.avatar',
      }),
    } as Response);

    const user = await getProviderUser('figma', 'token');

    expect(user).toHaveProperty('handle', 'figmauser');
  });

  it('should throw for unknown provider', async () => {
    await expect(getProviderUser('unknown' as OAuthProviderId, 'token')).rejects.toThrow('Unknown provider');
  });
});

describe('Provider Token Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should verify tokens through verifyProviderToken', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);

    expect(await verifyProviderToken('github', 'token')).toBe(true);
    expect(await verifyProviderToken('figma', 'token')).toBe(true);
    expect(await verifyProviderToken('notion', 'token')).toBe(true);
  });

  it('should return false for unknown provider', async () => {
    const result = await verifyProviderToken('unknown' as OAuthProviderId, 'token');

    expect(result).toBe(false);
  });
});
