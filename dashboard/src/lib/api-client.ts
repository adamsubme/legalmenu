'use client';

/**
 * Shared API client for Mission Control.
 *
 * Features:
 * - Automatic 401 handling (redirect to login)
 * - Consistent error handling
 * - Typed responses
 * - Flexible response parsing
 */

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface PaginatedResponse<T> {
  items: T[];
  count: number;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  headers?: Record<string, string>;
  body?: unknown;
};

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', headers = {}, body } = options;

    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const config: RequestInit = {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };

    const res = await fetch(url, config);

    if (res.status === 401) {
      window.location.href = '/login';
      throw new ApiError('Unauthorized', 401);
    }

    const text = await res.text();

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      let errorCode: string | undefined;

      try {
        const json = JSON.parse(text);
        errorMsg = json.error || errorMsg;
        errorCode = json.code;
      } catch {
        // Use status text if not JSON
      }

      throw new ApiError(errorMsg, res.status, errorCode);
    }

    if (!text) {
      return {} as T;
    }

    const data = JSON.parse(text) as T;
    return data;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Upload file with FormData (no JSON body)
   */
  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (res.status === 401) {
      window.location.href = '/login';
      throw new ApiError('Unauthorized', 401);
    }

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new ApiError(json.error || `HTTP ${res.status}`, res.status, json.code);
    }

    return res.json() as Promise<T>;
  }
}

export const api = new ApiClient();
