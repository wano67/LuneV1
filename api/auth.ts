import { apiFetch } from './http';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface SignupPayload {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  const res = await apiFetch<{ data: AuthResponse }>('/api/v1/auth/signup', {
    method: 'POST',
    body: payload as any,
  });
  return res.data;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const res = await apiFetch<{ data: AuthResponse }>('/api/v1/auth/login', {
    method: 'POST',
    body: payload as any,
  });
  return res.data;
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await apiFetch<{ data: AuthUser }>('/api/v1/me', {
    auth: true,
  });
  return res.data;
}
