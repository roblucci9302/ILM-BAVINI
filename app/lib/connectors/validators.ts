/**
 * Connector validation functions.
 * Each validator tests the API connection for a specific connector.
 */

import type { ConnectorId } from '~/lib/stores/connectors';

export interface ValidationResult {
  success: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

type ValidatorFn = (credentials: Record<string, string>) => Promise<ValidationResult>;

// API response types
interface GitHubUser {
  login: string;
  name: string | null;
}

interface StripeAccount {
  id: string;
  email: string | null;
}

interface NotionUser {
  name: string;
  type: string;
}

interface LinearResponse {
  errors?: Array<{ message: string }>;
  data?: { viewer?: { name: string; email: string } };
}

interface NetlifyUser {
  email: string;
  full_name: string;
}

interface FigmaUser {
  email: string;
  handle: string;
}

interface ElevenLabsUser {
  subscription?: { tier: string };
}

interface FirecrawlResponse {
  success: boolean;
  error?: string;
}

interface PerplexityResponse {
  id?: string;
  model?: string;
  choices?: Array<{ message: { content: string } }>;
  error?: { message: string };
}

interface N8nWorkflowsResponse {
  data?: Array<{ id: string; name: string }>;
  message?: string;
}

/**
 * API key format patterns for validation.
 */
const API_KEY_PATTERNS = {
  firecrawl: /^fc-[a-zA-Z0-9-]+$/,
  perplexity: /^pplx-[a-zA-Z0-9]+$/,
} as const;

/**
 * Validate GitHub credentials by fetching user info.
 */
async function validateGitHub(credentials: Record<string, string>): Promise<ValidationResult> {
  const { token } = credentials;

  if (!token) {
    return { success: false, error: 'Token requis' };
  }

  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Token invalide ou expiré' };
      }

      return { success: false, error: `Erreur GitHub: ${response.status}` };
    }

    const user = (await response.json()) as GitHubUser;

    return {
      success: true,
      details: { login: user.login, name: user.name },
    };
  } catch {
    return { success: false, error: 'Impossible de contacter GitHub' };
  }
}

/**
 * Validate Supabase credentials by checking project health.
 */
async function validateSupabase(credentials: Record<string, string>): Promise<ValidationResult> {
  const { url, anonKey } = credentials;

  if (!url || !anonKey) {
    return { success: false, error: 'URL et clé anon requis' };
  }

  try {
    // Test the REST API endpoint
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Clé API invalide' };
      }

      return { success: false, error: `Erreur Supabase: ${response.status}` };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Impossible de contacter Supabase' };
  }
}

/**
 * Validate Stripe credentials by fetching account info.
 */
async function validateStripe(credentials: Record<string, string>): Promise<ValidationResult> {
  const { secretKey } = credentials;

  if (!secretKey) {
    return { success: false, error: 'Clé secrète requise' };
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/account', {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Clé API invalide' };
      }

      return { success: false, error: `Erreur Stripe: ${response.status}` };
    }

    const account = (await response.json()) as StripeAccount;

    return {
      success: true,
      details: { id: account.id, email: account.email },
    };
  } catch {
    return { success: false, error: 'Impossible de contacter Stripe' };
  }
}

/**
 * Validate Notion credentials by fetching user info.
 */
async function validateNotion(credentials: Record<string, string>): Promise<ValidationResult> {
  const { integrationToken } = credentials;

  if (!integrationToken) {
    return { success: false, error: "Token d'intégration requis" };
  }

  try {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${integrationToken}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Token invalide' };
      }

      return { success: false, error: `Erreur Notion: ${response.status}` };
    }

    const user = (await response.json()) as NotionUser;

    return {
      success: true,
      details: { name: user.name, type: user.type },
    };
  } catch {
    return { success: false, error: 'Impossible de contacter Notion' };
  }
}

/**
 * Validate Linear credentials by fetching viewer info.
 */
async function validateLinear(credentials: Record<string, string>): Promise<ValidationResult> {
  const { apiKey } = credentials;

  if (!apiKey) {
    return { success: false, error: 'Clé API requise' };
  }

  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({
        query: '{ viewer { id name email } }',
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Clé API invalide' };
      }

      return { success: false, error: `Erreur Linear: ${response.status}` };
    }

    const data = (await response.json()) as LinearResponse;

    if (data.errors) {
      return { success: false, error: data.errors[0]?.message || 'Erreur Linear' };
    }

    return {
      success: true,
      details: { name: data.data?.viewer?.name, email: data.data?.viewer?.email },
    };
  } catch {
    return { success: false, error: 'Impossible de contacter Linear' };
  }
}

/**
 * Validate Netlify credentials by fetching user info.
 */
async function validateNetlify(credentials: Record<string, string>): Promise<ValidationResult> {
  const { accessToken } = credentials;

  if (!accessToken) {
    return { success: false, error: "Token d'accès requis" };
  }

  try {
    const response = await fetch('https://api.netlify.com/api/v1/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Token invalide' };
      }

      return { success: false, error: `Erreur Netlify: ${response.status}` };
    }

    const user = (await response.json()) as NetlifyUser;

    return {
      success: true,
      details: { email: user.email, full_name: user.full_name },
    };
  } catch {
    return { success: false, error: 'Impossible de contacter Netlify' };
  }
}

/**
 * Validate Figma credentials by fetching user info.
 */
async function validateFigma(credentials: Record<string, string>): Promise<ValidationResult> {
  const { accessToken } = credentials;

  if (!accessToken) {
    return { success: false, error: "Token d'accès requis" };
  }

  try {
    const response = await fetch('https://api.figma.com/v1/me', {
      headers: {
        'X-Figma-Token': accessToken,
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        return { success: false, error: 'Token invalide' };
      }

      return { success: false, error: `Erreur Figma: ${response.status}` };
    }

    const user = (await response.json()) as FigmaUser;

    return {
      success: true,
      details: { email: user.email, handle: user.handle },
    };
  } catch {
    return { success: false, error: 'Impossible de contacter Figma' };
  }
}

/**
 * Validate ElevenLabs credentials by fetching user info.
 */
async function validateElevenLabs(credentials: Record<string, string>): Promise<ValidationResult> {
  const { apiKey } = credentials;

  if (!apiKey) {
    return { success: false, error: 'Clé API requise' };
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Clé API invalide' };
      }

      return { success: false, error: `Erreur ElevenLabs: ${response.status}` };
    }

    const user = (await response.json()) as ElevenLabsUser;

    return {
      success: true,
      details: { subscription: user.subscription?.tier },
    };
  } catch {
    return { success: false, error: 'Impossible de contacter ElevenLabs' };
  }
}

/**
 * Validate Firecrawl credentials by testing the scrape endpoint.
 */
async function validateFirecrawl(credentials: Record<string, string>): Promise<ValidationResult> {
  const { apiKey } = credentials;

  if (!apiKey) {
    return { success: false, error: 'Clé API requise' };
  }

  // Validate API key format (fc-xxx)
  if (!API_KEY_PATTERNS.firecrawl.test(apiKey)) {
    return { success: false, error: 'Format de clé invalide (doit commencer par fc-)' };
  }

  try {
    // Test with a minimal scrape request to validate the key
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://example.com',
        formats: ['markdown'],
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Clé API invalide' };
      }

      if (response.status === 402) {
        return { success: false, error: 'Quota API épuisé' };
      }

      return { success: false, error: `Erreur Firecrawl: ${response.status}` };
    }

    const data = (await response.json()) as FirecrawlResponse;

    if (!data.success) {
      return { success: false, error: data.error || 'Erreur Firecrawl' };
    }

    return {
      success: true,
      details: { validated: true },
    };
  } catch {
    return { success: false, error: 'Impossible de contacter Firecrawl' };
  }
}

/**
 * Validate Perplexity credentials by testing the chat completions endpoint.
 */
async function validatePerplexity(credentials: Record<string, string>): Promise<ValidationResult> {
  const { apiKey } = credentials;

  if (!apiKey) {
    return { success: false, error: 'Clé API requise' };
  }

  // Validate API key format (pplx-xxx)
  if (!API_KEY_PATTERNS.perplexity.test(apiKey)) {
    return { success: false, error: 'Format de clé invalide (doit commencer par pplx-)' };
  }

  try {
    // Test with a minimal chat request to validate the key
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Clé API invalide' };
      }

      if (response.status === 429) {
        return { success: false, error: 'Limite de requêtes atteinte' };
      }

      return { success: false, error: `Erreur Perplexity: ${response.status}` };
    }

    const data = (await response.json()) as PerplexityResponse;

    if (data.error) {
      return { success: false, error: data.error.message || 'Erreur Perplexity' };
    }

    return {
      success: true,
      details: { model: data.model },
    };
  } catch {
    return { success: false, error: 'Impossible de contacter Perplexity' };
  }
}

/**
 * Validate n8n credentials by testing the workflows endpoint.
 */
async function validateN8n(credentials: Record<string, string>): Promise<ValidationResult> {
  const { instanceUrl, apiKey } = credentials;

  if (!instanceUrl) {
    return { success: false, error: "URL de l'instance requise" };
  }

  if (!apiKey) {
    return { success: false, error: 'Clé API requise' };
  }

  // Normalize the URL (remove trailing slash)
  const baseUrl = instanceUrl.replace(/\/$/, '');

  try {
    // Test by fetching workflows list
    const response = await fetch(`${baseUrl}/api/v1/workflows`, {
      headers: {
        'X-N8N-API-KEY': apiKey,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Clé API invalide' };
      }

      if (response.status === 404) {
        return { success: false, error: 'URL invalide ou API non accessible' };
      }

      return { success: false, error: `Erreur n8n: ${response.status}` };
    }

    const data = (await response.json()) as N8nWorkflowsResponse;

    return {
      success: true,
      details: { workflowCount: data.data?.length || 0 },
    };
  } catch {
    return { success: false, error: 'Impossible de contacter n8n' };
  }
}

/**
 * Generic validator for connectors without specific validation.
 * Just checks that required fields are present.
 */
async function validateGeneric(credentials: Record<string, string>): Promise<ValidationResult> {
  const hasValues = Object.values(credentials).some((v) => v && v.trim().length > 0);

  if (!hasValues) {
    return { success: false, error: 'Credentials requis' };
  }

  // For connectors without API validation, assume success if fields are filled
  return { success: true };
}

/**
 * Map of connector IDs to their validation functions.
 */
const validators: Partial<Record<ConnectorId, ValidatorFn>> = {
  github: validateGitHub,
  supabase: validateSupabase,
  stripe: validateStripe,
  notion: validateNotion,
  linear: validateLinear,
  netlify: validateNetlify,
  figma: validateFigma,
  elevenlabs: validateElevenLabs,
  firecrawl: validateFirecrawl,
  perplexity: validatePerplexity,
  n8n: validateN8n,
};

/**
 * Validate credentials for a connector.
 * Returns validation result with success status and optional error message.
 */
export async function validateConnector(
  id: ConnectorId,
  credentials: Record<string, string>,
): Promise<ValidationResult> {
  const validator = validators[id];

  if (validator) {
    return validator(credentials);
  }

  // Use generic validation for connectors without specific validators
  return validateGeneric(credentials);
}

/**
 * Check if a connector has a specific validator.
 */
export function hasValidator(id: ConnectorId): boolean {
  return id in validators;
}
