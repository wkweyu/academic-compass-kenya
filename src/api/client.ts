import { authHeaders } from './api';
import { parseError, StandardError } from '@/utils/errorHandler';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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

    const response = await fetch(`${API_URL}/api/${endpoint}`, config);

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

    // Parse and wrap other errors
    const standardError = parseError(error, `API: ${method} ${endpoint}`);
    throw new ApiError(standardError);
  }
}

export default client;
