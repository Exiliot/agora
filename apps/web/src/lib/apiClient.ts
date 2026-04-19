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

// H6: single place to notify the app when any call returns 401. The App
// wires a handler that clears the `me` cache so ProtectedRoute can redirect
// to /sign-in. Kept as a module-level hook rather than reading the query
// client directly so the client stays free of TanStack imports.
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null): void => {
  unauthorizedHandler = handler;
};

// The `GET /api/auth/me` probe is allowed to return 401 – that's how a
// signed-out session is represented – so we must not treat its own 401 as
// a session revoke. Anything else wants the global fall-through.
const isAuthProbe = (method: string, path: string): boolean =>
  method === 'GET' && path === '/auth/me';

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
    if (response.status === 401 && !isAuthProbe(method, path) && unauthorizedHandler) {
      unauthorizedHandler();
    }
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
