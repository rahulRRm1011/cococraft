import { config } from '../config/env.js';

export class StrapiService {
  private baseUrl: string;
  private apiToken: string;

  constructor() {
    this.baseUrl = config.strapiUrl.replace(/\/+$/, '');
    this.apiToken = config.strapiApiToken;
  }

  /**
   * Performs an HTTP GET request to Strapi's REST API
   */
  public async get<T = any>(endpoint: string, queryParams: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${this.baseUrl}/api${cleanEndpoint}`);

    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Strapi request failed (${response.status}): ${errorText}`);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      // Log for server diagnostics without leaking to client
      console.error(`[StrapiService] Error querying ${url.pathname}:`, err.message);
      throw err;
    }
  }
}

export const strapiService = new StrapiService();
