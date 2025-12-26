/**
 * Shopify SDK.
 *
 * Lightweight client for Shopify Admin API.
 */

// Types
export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  status: 'active' | 'archived' | 'draft';
  variants: Array<{ id: number; price: string; sku: string; inventory_quantity: number }>;
  images: Array<{ id: number; src: string }>;
}

export interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  total_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  line_items: Array<{ id: number; title: string; quantity: number; price: string }>;
  customer: { id: number; email: string } | null;
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  total_spent: string;
}

export interface ShopifyInventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
}

// Client
export class ShopifyClient {
  private readonly shopDomain: string;
  private readonly accessToken: string;
  private readonly apiVersion = '2024-01';

  constructor(config: { shopDomain: string; accessToken: string }) {
    if (!config.shopDomain) {
      throw new Error('Shopify shop domain is required');
    }

    if (!config.accessToken) {
      throw new Error('Shopify access token is required');
    }

    this.shopDomain = config.shopDomain.replace(/\/$/, '');
    this.accessToken = config.accessToken;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { errors?: string };
      throw new Error(error.errors || `Shopify API error: ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.get('/shop.json');
      return true;
    } catch {
      return false;
    }
  }
}

export function createShopifyClient(shopDomain: string, accessToken: string): ShopifyClient {
  return new ShopifyClient({ shopDomain, accessToken });
}

// Product functions
export async function listProducts(
  client: ShopifyClient,
  options?: { limit?: number; status?: string },
): Promise<ShopifyProduct[]> {
  const params = new URLSearchParams();

  if (options?.limit) {
    params.set('limit', String(options.limit));
  }

  if (options?.status) {
    params.set('status', options.status);
  }

  const query = params.toString();
  const result = await client.get<{ products: ShopifyProduct[] }>(`/products.json${query ? `?${query}` : ''}`);

  return result.products;
}

export async function getProduct(client: ShopifyClient, productId: number): Promise<ShopifyProduct> {
  const result = await client.get<{ product: ShopifyProduct }>(`/products/${productId}.json`);
  return result.product;
}

export async function createProduct(client: ShopifyClient, data: Partial<ShopifyProduct>): Promise<ShopifyProduct> {
  const result = await client.post<{ product: ShopifyProduct }>('/products.json', { product: data });
  return result.product;
}

export async function updateProduct(
  client: ShopifyClient,
  productId: number,
  data: Partial<ShopifyProduct>,
): Promise<ShopifyProduct> {
  const result = await client.put<{ product: ShopifyProduct }>(`/products/${productId}.json`, { product: data });
  return result.product;
}

export async function deleteProduct(client: ShopifyClient, productId: number): Promise<void> {
  await client.delete(`/products/${productId}.json`);
}

// Order functions
export async function listOrders(
  client: ShopifyClient,
  options?: { status?: string; limit?: number },
): Promise<ShopifyOrder[]> {
  const params = new URLSearchParams();

  if (options?.status) {
    params.set('status', options.status);
  }

  if (options?.limit) {
    params.set('limit', String(options.limit));
  }

  const query = params.toString();
  const result = await client.get<{ orders: ShopifyOrder[] }>(`/orders.json${query ? `?${query}` : ''}`);

  return result.orders;
}

export async function getOrder(client: ShopifyClient, orderId: number): Promise<ShopifyOrder> {
  const result = await client.get<{ order: ShopifyOrder }>(`/orders/${orderId}.json`);
  return result.order;
}

export async function updateOrder(
  client: ShopifyClient,
  orderId: number,
  data: Partial<ShopifyOrder>,
): Promise<ShopifyOrder> {
  const result = await client.put<{ order: ShopifyOrder }>(`/orders/${orderId}.json`, { order: data });
  return result.order;
}

// Customer functions
export async function listCustomers(client: ShopifyClient, options?: { limit?: number }): Promise<ShopifyCustomer[]> {
  const query = options?.limit ? `?limit=${options.limit}` : '';
  const result = await client.get<{ customers: ShopifyCustomer[] }>(`/customers.json${query}`);

  return result.customers;
}

export async function getCustomer(client: ShopifyClient, customerId: number): Promise<ShopifyCustomer> {
  const result = await client.get<{ customer: ShopifyCustomer }>(`/customers/${customerId}.json`);
  return result.customer;
}

export async function createCustomer(client: ShopifyClient, data: Partial<ShopifyCustomer>): Promise<ShopifyCustomer> {
  const result = await client.post<{ customer: ShopifyCustomer }>('/customers.json', { customer: data });
  return result.customer;
}

// Inventory functions
export async function getInventoryLevels(
  client: ShopifyClient,
  inventoryItemIds: number[],
): Promise<ShopifyInventoryLevel[]> {
  const ids = inventoryItemIds.join(',');
  const result = await client.get<{ inventory_levels: ShopifyInventoryLevel[] }>(
    `/inventory_levels.json?inventory_item_ids=${ids}`,
  );

  return result.inventory_levels;
}

export async function setInventoryLevel(
  client: ShopifyClient,
  inventoryItemId: number,
  locationId: number,
  available: number,
): Promise<ShopifyInventoryLevel> {
  const result = await client.post<{ inventory_level: ShopifyInventoryLevel }>('/inventory_levels/set.json', {
    inventory_item_id: inventoryItemId,
    location_id: locationId,
    available,
  });
  return result.inventory_level;
}
