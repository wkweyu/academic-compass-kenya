import { authHeaders, resolveApiBaseUrl } from './api';
import { parseError, StandardError, ErrorCategory, ErrorSeverity } from '@/utils/errorHandler';

const BASE_URL = resolveApiBaseUrl();
const API_ROOT = `${BASE_URL}/api`;

/**
 * Builds a fully qualified API URL from an endpoint string.
 * Ensures the result starts with BASE_URL/api/
 */
function buildApiUrl(endpoint: string) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_ROOT}/${cleanEndpoint}`;
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();
  const trimmedText = rawText.trim();
  const isJson = contentType.includes('application/json') || contentType.includes('application/problem+json');

  if (!trimmedText) {
    return { contentType, rawText, parsed: undefined, isJson };
  }

  if (isJson) {
    try {
      return { contentType, rawText, parsed: JSON.parse(trimmedText), isJson };
    } catch {
      return { contentType, rawText, parsed: undefined, isJson };
    }
  }

  return { contentType, rawText, parsed: undefined, isJson };
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
      ? 'The request reached a web page instead of the API. Check the deployed backend URL or proxy configuration.'
      : 'The API returned an unexpected response format.',
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.CRITICAL,
    timestamp: new Date().toISOString(),
    action: import.meta.env.DEV
      ? 'Verify the backend route and confirm it returns JSON.'
      : 'Configure VITE_API_URL or ensure the backend is reachable.',
    details: `Target: ${targetUrl} | Status: ${response.status} | Content-Type: ${responseKind}`
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

/**
 * Standard fetch-based client for API calls.
 * Prepends /api to all endpoints automatically.
 */
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
        throw buildUnexpectedResponseError({ endpoint, response, body: rawText, contentType });
      }

      const errorData = (parsed as Record<string, unknown> | undefined) || { message: response.statusText };
      const standardError = parseError(
        { response: { status: response.status, data: errorData } },
        `API: ${method} ${endpoint}`
      );

      throw new ApiError(standardError, response.status);
    }

    if (response.status === 204) {
      return Promise.resolve(undefined as T);
    }

    if (!isJson || (typeof parsed === 'undefined' && rawText)) {
      throw buildUnexpectedResponseError({ endpoint, response, body: rawText, contentType });
    }

    return parsed as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.message === 'Failed to fetch') {
      const targetUrl = buildApiUrl(endpoint);
      const networkError: StandardError = {
        message: 'Unable to reach the application API. Check your connection or the backend status.',
        code: 'BACKEND_NOT_RUNNING',
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.CRITICAL,
        timestamp: new Date().toISOString(),
        action: 'Ensure the Django backend is running and VITE_API_URL is correct.',
        details: `Failed to fetch from: ${targetUrl}`
      };
      throw new ApiError(networkError);
    }

    throw new ApiError(parseError(error, `API: ${method} ${endpoint}`));
  }
}

export default client;
