function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  // Under Vercel Services (deployed or `vercel dev`), `/api/(.*)` routes to the `api` service on the same domain.
  if (process.env.NEXT_PUBLIC_VERCEL === '1') {
    return '/api/v1';
  }
  if (typeof window !== 'undefined') {
    const { hostname, port } = window.location;
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '3000') {
      return 'http://localhost:4000/api/v1';
    }
    return '/api/v1';
  }
  return 'http://localhost:4000/api/v1';
}

export const API_BASE = resolveApiBase();

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('sl_access_token');
}

export function setStoredTokens(accessToken: string, refreshToken?: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('sl_access_token', accessToken);
  if (refreshToken) {
    window.localStorage.setItem('sl_refresh_token', refreshToken);
  }
}

export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('sl_access_token');
  window.localStorage.removeItem('sl_refresh_token');
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const resp = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const isJson = resp.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await resp.json() : null;

  if (!resp.ok) {
    throw new ApiError(
      resp.status,
      body?.error?.code || 'API_ERROR',
      body?.error?.message || `Request failed with status ${resp.status}`,
      body?.error?.details,
    );
  }

  return body as T;
}

export function formatMoney(minor: number | null | undefined, currency = 'INR'): string {
  if (minor === null || minor === undefined) return '—';
  const major = minor / 100;
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(major);
}

export function formatLabel(raw: string | null | undefined): string {
  if (!raw) return '—';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
