/**
 * Typed HTTP client. Thin wrapper over fetch that:
 *   - routes to `/api/*` (proxied to the backend via nginx in prod, vite in dev)
 *   - sends/receives JSON
 *   - includes cookies (the session cookie)
 *   - surfaces non-2xx responses as ApiError with the server's error shape
 */

export interface ApiErrorShape {
  error?: string;
  code?: string;
  message?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorShape | null;

  constructor(status: number, body: ApiErrorShape | null, message: string) {
    super(message);
    this.status = status;
    this.body = body;
    this.name = 'ApiError';
  }
}

const parseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const request = async <T>(
  method: string,
  path: string,
  body: unknown,
): Promise<T> => {
  const init: RequestInit = { method, credentials: 'include' };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`/api${path}`, init);

  const parsed = await parseBody(response);

  if (!response.ok) {
    const shape = (parsed ?? {}) as ApiErrorShape;
    throw new ApiError(
      response.status,
      shape,
      shape.message ?? shape.error ?? `HTTP ${response.status}`,
    );
  }

  return parsed as T;
};

export const api = {
  get: <T>(path: string): Promise<T> => request<T>('GET', path, undefined),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown): Promise<T> => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown): Promise<T> => request<T>('PATCH', path, body),
  delete: <T>(path: string, body?: unknown): Promise<T> => request<T>('DELETE', path, body),
};
