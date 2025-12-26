/**
 * Stripe SDK.
 *
 * Lightweight client for Stripe API.
 */

// Types
export interface StripeCustomer {
  id: string;
  object: 'customer';
  email: string | null;
  name: string | null;
  created: number;
  metadata: Record<string, string>;
}

export interface StripeProduct {
  id: string;
  object: 'product';
  name: string;
  description: string | null;
  active: boolean;
  metadata: Record<string, string>;
}

export interface StripePrice {
  id: string;
  object: 'price';
  product: string;
  unit_amount: number | null;
  currency: string;
  type: 'one_time' | 'recurring';
}

export interface StripePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  currency: string;
  status: string;
  client_secret: string;
}

export interface StripeCheckoutSession {
  id: string;
  object: 'checkout.session';
  url: string | null;
  payment_status: string;
  status: string;
}

export interface StripeSubscription {
  id: string;
  object: 'subscription';
  customer: string;
  status: string;
  items: { data: Array<{ price: StripePrice }> };
}

export interface StripeList<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
}

// Client
export class StripeClient {
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.stripe.com/v1';

  constructor(config: { secretKey: string }) {
    if (!config.secretKey) {
      throw new Error('Stripe secret key is required');
    }

    this.secretKey = config.secretKey;
  }

  private encodeBody(data: Record<string, unknown>): string {
    const params = new URLSearchParams();

    function flatten(obj: Record<string, unknown>, prefix = ''): void {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}[${key}]` : key;

        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          flatten(value as Record<string, unknown>, fullKey);
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object') {
              flatten(item as Record<string, unknown>, `${fullKey}[${index}]`);
            } else {
              params.append(`${fullKey}[${index}]`, String(item));
            }
          });
        } else if (value !== undefined) {
          params.append(fullKey, String(value));
        }
      }
    }

    flatten(data);

    return params.toString();
  }

  private async request<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const auth = btoa(`${this.secretKey}:`);
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body ? this.encodeBody(body) : undefined,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(error.error?.message || `Stripe API error: ${response.status}`);
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async validateKey(): Promise<boolean> {
    try {
      await this.get('/account');
      return true;
    } catch {
      return false;
    }
  }
}

export function createStripeClient(secretKey: string): StripeClient {
  return new StripeClient({ secretKey });
}

// Customer functions
export async function listCustomers(client: StripeClient, limit = 10): Promise<StripeList<StripeCustomer>> {
  return client.get(`/customers?limit=${limit}`);
}

export async function getCustomer(client: StripeClient, customerId: string): Promise<StripeCustomer> {
  return client.get(`/customers/${customerId}`);
}

export async function createCustomer(
  client: StripeClient,
  data: { email?: string; name?: string; metadata?: Record<string, string> },
): Promise<StripeCustomer> {
  return client.post('/customers', data);
}

export async function updateCustomer(
  client: StripeClient,
  customerId: string,
  data: Partial<{ email: string; name: string; metadata: Record<string, string> }>,
): Promise<StripeCustomer> {
  return client.post(`/customers/${customerId}`, data);
}

// Product functions
export async function listProducts(client: StripeClient, limit = 10): Promise<StripeList<StripeProduct>> {
  return client.get(`/products?limit=${limit}`);
}

export async function createProduct(
  client: StripeClient,
  data: { name: string; description?: string },
): Promise<StripeProduct> {
  return client.post('/products', data);
}

// Price functions
export async function listPrices(client: StripeClient, limit = 10): Promise<StripeList<StripePrice>> {
  return client.get(`/prices?limit=${limit}`);
}

export async function createPrice(
  client: StripeClient,
  data: { product: string; unit_amount: number; currency: string; recurring?: { interval: string } },
): Promise<StripePrice> {
  return client.post('/prices', data);
}

// Payment Intent functions
export async function createPaymentIntent(
  client: StripeClient,
  data: { amount: number; currency: string; customer?: string; payment_method_types?: string[] },
): Promise<StripePaymentIntent> {
  return client.post('/payment_intents', data);
}

export async function confirmPaymentIntent(
  client: StripeClient,
  paymentIntentId: string,
  data?: { payment_method?: string },
): Promise<StripePaymentIntent> {
  return client.post(`/payment_intents/${paymentIntentId}/confirm`, data);
}

// Checkout Session functions
export async function createCheckoutSession(
  client: StripeClient,
  data: {
    line_items: Array<{ price: string; quantity: number }>;
    mode: 'payment' | 'subscription' | 'setup';
    success_url: string;
    cancel_url: string;
  },
): Promise<StripeCheckoutSession> {
  return client.post('/checkout/sessions', data);
}

// Subscription functions
export async function listSubscriptions(
  client: StripeClient,
  customerId?: string,
): Promise<StripeList<StripeSubscription>> {
  const query = customerId ? `?customer=${customerId}` : '';
  return client.get(`/subscriptions${query}`);
}

export async function createSubscription(
  client: StripeClient,
  data: { customer: string; items: Array<{ price: string }> },
): Promise<StripeSubscription> {
  return client.post('/subscriptions', data);
}

export async function cancelSubscription(client: StripeClient, subscriptionId: string): Promise<StripeSubscription> {
  return client.delete(`/subscriptions/${subscriptionId}`);
}
