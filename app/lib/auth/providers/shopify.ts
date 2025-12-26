/**
 * Shopify OAuth Provider Configuration.
 *
 * Shopify OAuth 2.0 implementation.
 * https://shopify.dev/docs/apps/build/authentication-authorization.
 */

import type { OAuthProviderConfig } from '~/lib/auth/oauth';

/**
 * Shopify OAuth scopes.
 */
export const SHOPIFY_SCOPES = {
  READ_PRODUCTS: 'read_products',
  READ_ORDERS: 'read_orders',
  READ_CUSTOMERS: 'read_customers',
  READ_INVENTORY: 'read_inventory',
} as const;

/**
 * Default scopes for BAVINI Shopify integration.
 */
export const DEFAULT_SHOPIFY_SCOPES = [
  SHOPIFY_SCOPES.READ_PRODUCTS,
  SHOPIFY_SCOPES.READ_ORDERS,
  SHOPIFY_SCOPES.READ_CUSTOMERS,
  SHOPIFY_SCOPES.READ_INVENTORY,
];

/**
 * Create Shopify OAuth provider configuration.
 * Note: Shopify requires the shop domain to be included in the authorization URL.
 */
export function createShopifyProvider(
  clientId: string,
  clientSecret?: string,
  shopDomain?: string,
): OAuthProviderConfig {
  const baseAuthUrl = shopDomain
    ? `https://${shopDomain}/admin/oauth/authorize`
    : 'https://SHOP_DOMAIN/admin/oauth/authorize';

  const baseTokenUrl = shopDomain
    ? `https://${shopDomain}/admin/oauth/access_token`
    : 'https://SHOP_DOMAIN/admin/oauth/access_token';

  return {
    id: 'shopify',
    name: 'Shopify',
    authorizationUrl: baseAuthUrl,
    tokenUrl: baseTokenUrl,
    scopes: DEFAULT_SHOPIFY_SCOPES,
    clientId,
    clientSecret,
    usePKCE: false,
  };
}

/**
 * Shopify shop info response.
 */
export interface ShopifyShop {
  id: number;
  name: string;
  email: string;
  domain: string;
  myshopify_domain: string;
  shop_owner: string;
  currency: string;
  plan_name: string;
}

/**
 * Exchange Shopify authorization code for access token.
 */
export async function exchangeShopifyCode(
  shopDomain: string,
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<{ access_token: string; scope: string }> {
  const normalizedDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const response = await fetch(`https://${normalizedDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange Shopify code: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Fetch Shopify shop info using access token.
 */
export async function getShopifyShop(accessToken: string, shopDomain: string): Promise<ShopifyShop> {
  const normalizedDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const response = await fetch(`https://${normalizedDomain}/admin/api/2024-01/shop.json`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch Shopify shop: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { shop: ShopifyShop };

  return data.shop;
}

/**
 * Verify Shopify token is still valid.
 */
export async function verifyShopifyToken(accessToken: string, shopDomain: string): Promise<boolean> {
  try {
    const normalizedDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const response = await fetch(`https://${normalizedDomain}/admin/api/2024-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}
