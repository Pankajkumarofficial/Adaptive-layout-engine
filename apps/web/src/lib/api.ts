import type { AdSpec, LayoutResult } from '@ale/engine';

/**
 * In development the Vite server proxies /api to the backend; in production
 * VITE_API_URL points at the deployed API. Credentials are always included
 * because the session lives in an httpOnly cookie.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: 'include',
    headers: init.body === undefined ? {} : { 'content-type': 'application/json' },
    ...init,
  });

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string; details?: unknown } })
      ?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? `Request failed with ${res.status}`,
      err?.details,
    );
  }
  return (payload as { data: T }).data;
}

export interface Account {
  id: string;
  email: string;
}

export interface StoredSpec {
  id: string;
  name: string;
  spec: AdSpec;
  updatedAt?: string;
}

export const api = {
  me: () => call<Account>('/auth/me'),
  register: (email: string, password: string) =>
    call<Account>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    call<Account>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => call<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  listSpecs: (q = '') =>
    call<{ items: StoredSpec[]; total: number }>(`/specs?limit=50&q=${encodeURIComponent(q)}`),
  createSpec: (spec: AdSpec) =>
    call<StoredSpec>('/specs', { method: 'POST', body: JSON.stringify({ spec }) }),
  updateSpec: (id: string, spec: AdSpec) =>
    call<StoredSpec>(`/specs/${id}`, { method: 'PATCH', body: JSON.stringify({ spec }) }),
  deleteSpec: (id: string) => call<{ deleted: boolean }>(`/specs/${id}`, { method: 'DELETE' }),
  duplicateSpec: (id: string) => call<StoredSpec>(`/specs/${id}/duplicate`, { method: 'POST' }),
  share: (id: string) => call<{ slug: string }>(`/specs/${id}/share`, { method: 'POST' }),

  shared: (slug: string) =>
    call<{ slug: string; name: string; spec: AdSpec; results: LayoutResult[] }>(`/public/${slug}`),
};
