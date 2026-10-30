const TOKEN_KEY = 'entt_token';

/**
 * In-memory mirror of the session token.
 *
 * Embedded previews and strict privacy modes can block or partition
 * `localStorage`. Falling back to memory keeps the session alive for the
 * lifetime of the tab instead of silently signing the user out mid-session.
 */
let memoryToken: string | null = null;

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? memoryToken;
    } catch {
      return memoryToken;
    }
  },
  set: (token: string) => {
    memoryToken = token;
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable — memory fallback keeps us signed in */
    }
  },
  clear: () => {
    memoryToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;

  constructor(status: number, message: string, code?: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  raw?: boolean;
}

function authHeaders(): Record<string, string> {
  const token = tokenStore.get();
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const isForm = body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'include',
      signal,
      headers: {
        ...(isForm ? {} : body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...authHeaders(),
      },
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'Unable to reach the server. Check your connection and try again.', 'NETWORK');
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => '');

  if (!response.ok) {
    if (response.status === 401) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('sentinel:unauthorized'));
    }
    const message = (isJson && payload && (payload.error || payload.message)) || `Request failed with status ${response.status}.`;
    throw new ApiError(response.status, message, isJson ? payload?.code : undefined, isJson ? payload?.fields : undefined);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form }),
  async blob(path: string) {
    const response = await fetch(path, { credentials: 'include', headers: authHeaders() });
    if (!response.ok) throw new ApiError(response.status, 'Could not load the file.');
    return response.blob();
  },
  async download(path: string, fallbackName: string) {
    const response = await fetch(path, { credentials: 'include', headers: authHeaders() });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(response.status, data?.error || 'Download failed.', data?.code);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const name = match?.[1] || fallbackName;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return name;
  },
};

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
