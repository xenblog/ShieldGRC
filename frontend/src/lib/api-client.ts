// Access token is kept in memory only (never localStorage - see
// ARCHITECTURE.md "Security-relevant defaults"). The httpOnly refresh
// cookie (set by the backend, scoped to /api/auth) is what actually
// survives a page reload; AuthProvider exchanges it for a fresh access
// token on mount via POST /auth/refresh.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (typeof body.message === 'string') return body.message;
  } catch {
    // response body wasn't JSON - fall through to the generic message
  }
  return `Request failed with status ${res.status}`;
}

async function doFetch(method: string, path: string, body: unknown, token: string | null): Promise<Response> {
  return fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Exchanges the httpOnly refresh cookie for a fresh access token. Also used by AuthProvider on mount. */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) return false;
    const data = await res.json();
    accessToken = data.accessToken;
    return true;
  } catch {
    return false;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await doFetch(method, path, body, accessToken);

  // A single silent-refresh retry: the in-memory access token can go stale
  // (15 min default) well before the httpOnly refresh cookie does.
  if (res.status === 401 && accessToken !== null) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch(method, path, body, accessToken);
    }
  }

  if (!res.ok) {
    throw new ApiError(await extractErrorMessage(res), res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
