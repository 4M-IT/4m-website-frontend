const ACCESS_TOKEN_KEY = 'cmsAccessToken';
const REFRESH_TOKEN_KEY = 'cmsRefreshToken';

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message: string;
};

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function getAccessToken(): string {
  return getStorage()?.getItem(ACCESS_TOKEN_KEY) ?? '';
}

export function getRefreshToken(): string {
  return getStorage()?.getItem(REFRESH_TOKEN_KEY) ?? '';
}

export function clearAuthTokens(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
}

function setAuthTokens(accessToken: string, refreshToken: string): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch('/api/backend/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as ApiEnvelope<{ accessToken: string; refreshToken: string }>;
  if (!res.ok || !body?.success) {
    throw new Error(body?.message || 'Login failed');
  }
  setAuthTokens(body.data.accessToken, body.data.refreshToken);
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch('/api/backend/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearAuthTokens();
    return false;
  }
  const body = (await res.json()) as ApiEnvelope<{ accessToken: string }>;
  if (!body?.success || !body.data?.accessToken) {
    clearAuthTokens();
    return false;
  }
  const storage = getStorage();
  storage?.setItem(ACCESS_TOKEN_KEY, body.data.accessToken);
  return true;
}

export async function adminApiFetch<T = JsonValue>(
  path: string,
  init?: RequestInit,
  retry: boolean = true,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`/api/backend${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return adminApiFetch<T>(path, init, false);
    }
  }

  const body = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !body?.success) {
    throw new Error(body?.message || `Request failed: ${res.status}`);
  }
  return body.data;
}

export async function requireAdminSession(): Promise<void> {
  await adminApiFetch('/users/me');
}
