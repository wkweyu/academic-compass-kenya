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

function buildApiUrl(endpoint: string) {
  return `${API_URL}/${endpoint}`;
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();
  const trimmedText = rawText.trim();
  const isJson = contentType.includes('application/json') || contentType.includes('application/problem+json');

  if (!trimmedText) {
    return {
      contentType,
      rawText,
      parsed: undefined as unknown,
      isJson,
    };
  }

  if (isJson) {
    try {
      return {
        contentType,
        rawText,
        parsed: JSON.parse(trimmedText) as unknown,
        isJson,
      };
    } catch {
      return {
        contentType,
        rawText,
        parsed: undefined as unknown,
        isJson,
      };
    };
  }

  return {
    contentType,
    rawText,
    parsed: undefined as unknown,
    isJson,
  };
}

function looksLikeHtmlDocument(body: string) {
  return /<(?:!doctype html|html|head|body)\b/i.test(body);
}

function buildUnexpectedResponseError({
  endpoint,
  response,
  body,
  contentType,
}: {
  endpoint: string;
  response: Response;
  body: string;
  contentType: string;
}) {
  const targetUrl = buildApiUrl(endpoint);
  const htmlResponse = looksLikeHtmlDocument(body);
  const responseKind = htmlResponse ? 'HTML' : contentType || 'non-JSON';

  const standardError: StandardError = {
    code: 'INVALID_API_RESPONSE',
    message: htmlResponse
      ? 'The request reached a web page instead of the API. Check the deployed backend URL or API proxy configuration.'
      : 'The API returned an unexpected response format.',
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.CRITICAL,
    timestamp: new Date().toISOString(),
    action: import.meta.env.DEV
      ? 'Verify the backend route and confirm it returns JSON.'
      : 'Configure VITE_API_URL or expose the backend API under /api on the deployed host.',
    details: import.meta.env.DEV
      ? `Expected JSON from ${targetUrl} but received ${responseKind} (status ${response.status}).\n\nBody preview:\n${body.slice(0, 400)}`
      : `Expected JSON from ${targetUrl} but received ${responseKind} (status ${response.status}).`,
  };

  return new ApiError(standardError, response.status);
}

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

    const response = await fetch(buildApiUrl(endpoint), config);
    const { contentType, rawText, parsed, isJson } = await readResponseBody(response);

    if (!response.ok) {
      if (!isJson && rawText) {
        throw buildUnexpectedResponseError({
          endpoint,
          response,
          body: rawText,
          contentType,
        });
      }

      const errorData = (parsed as Record<string, unknown> | undefined) || { message: response.statusText };

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

    if (!isJson) {
      throw buildUnexpectedResponseError({
        endpoint,
        response,
        body: rawText,
        contentType,
      });
    }

    if (typeof parsed === 'undefined' && rawText) {
      throw buildUnexpectedResponseError({
        endpoint,
        response,
        body: rawText,
        contentType,
      });
    }

    return parsed as T;
  } catch (error) {
    // If it's already an ApiError, rethrow it
    if (error instanceof ApiError) {
      throw error;
    }

    // Check if this is a network error (Django not running)
    if (error instanceof Error && error.message === 'Failed to fetch') {
      const targetUrl = buildApiUrl(endpoint);
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
