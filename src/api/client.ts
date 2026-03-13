import { authHeaders } from './api';
import { parseError, StandardError, ErrorCategory, ErrorSeverity } from '@/utils/errorHandler';

function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8000/api';
  }

  const { origin, hostname } = window.location;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  return isLocalhost ? 'http://localhost:8000/api' : `${origin}/api`;
}

const API_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  public standardError: StandardError;
  public status?: number;

  constructor(standardError: StandardError, status?: number) {
    super(standardError.message);
    this.name = 'ApiError';
    this.standardError = standardError;
    this.status = status;
  }
}

async function client<T>(
  endpoint: string,
  { data, method = 'GET', customHeaders, ...customConfig }: RequestInit & { data?: any; customHeaders?: HeadersInit } = {}
): Promise<T> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...customHeaders,
    };

    const config: RequestInit = {
      method,
      headers,
      ...customConfig,
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_URL}/${endpoint}`, config);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }

      const standardError = parseError(
        { 
          response: { 
            status: response.status, 
            data: errorData 
          } 
        },
        `API: ${method} ${endpoint}`
      );

      throw new ApiError(standardError, response.status);
    }

    if (response.status === 204) {
      return Promise.resolve(undefined as T);
    }

    return response.json();
  } catch (error) {
    // If it's already an ApiError, rethrow it
    if (error instanceof ApiError) {
      throw error;
    }

    // Check if this is a network error (Django not running)
    if (error instanceof Error && error.message === 'Failed to fetch') {
      const targetUrl = `${API_URL}/${endpoint}`;
      const networkError: StandardError = {
        message: import.meta.env.DEV
          ? 'Backend server is not running. Please start Django with: python manage.py runserver'
          : 'Unable to reach the application API. Check the deployed API URL or reverse proxy configuration.',
        code: 'BACKEND_NOT_RUNNING',
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.CRITICAL,
        timestamp: new Date().toISOString(),
        action: import.meta.env.DEV
          ? 'Start Django server with: python manage.py runserver'
          : 'Configure VITE_API_URL or expose /api from the deployed host',
        details: import.meta.env.DEV
          ? '⚠️ Django Backend Not Running!\n\nPlease start the Django server:\n1. Open a terminal\n2. Run: python manage.py runserver\n3. Keep the terminal open\n4. Try again'
          : `⚠️ API Unreachable\n\nThe frontend tried to call:\n${targetUrl}\n\nSet VITE_API_URL to the live backend origin, or proxy /api on the deployed host.`
      };
      throw new ApiError(networkError);
    }

    // Parse and wrap other errors
    const standardError = parseError(error, `API: ${method} ${endpoint}`);
    throw new ApiError(standardError);
  }
}

export default client;
