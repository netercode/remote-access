const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || 'Request failed.', res.status);
  }
  return data as T;
}

export const api = {
  signup: (email: string, password: string) =>
    request<{ ok: true; email: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ ok: true; email: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ authenticated: boolean; email: string | null }>('/api/auth/me'),

  getSafetyWallet: () => request<{ address: string | null }>('/api/safety-wallet'),
  setSafetyWallet: (address: string) =>
    request<{ address: string }>('/api/safety-wallet', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

  getEmergencyLink: () =>
    request<{ active: boolean; createdAt: string | null }>('/api/emergency-link'),
  regenerateEmergencyLink: () =>
    request<{ token: string }>('/api/emergency-link/regenerate', { method: 'POST' }),
  revokeEmergencyLink: () => request<{ ok: true }>('/api/emergency-link/revoke', { method: 'POST' }),
  resolveEmergencyLink: (token: string) =>
    request<{ safetyAddress: string }>('/api/emergency-link/resolve', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
};
