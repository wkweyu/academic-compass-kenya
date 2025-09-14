import { authHeaders } from './api';

const API_URL = "http://127.0.0.1:8000/api";

async function client<T>(
  endpoint: string,
  { data, method = 'GET', customHeaders, ...customConfig }: RequestInit & { data?: any; customHeaders?: HeadersInit } = {}
): Promise<T> {
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
    const error = await response.json();
    return Promise.reject(error);
  }

  if (response.status === 204) {
    return Promise.resolve(undefined as T);
  }

  return response.json();
}

export default client;
