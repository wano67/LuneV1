/**
 * HTTP Client for Lune API
 * Handles authentication, error handling, and type-safe requests
 */

let authToken: string | null = null;

export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not set');
  }
  return url;
}

export function getDevToken(): string | null {
  return process.env.NEXT_PUBLIC_LUNE_DEV_TOKEN || null;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

type ApiFetchOptions = RequestInit & { auth?: boolean };

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const cleanedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${cleanedPath}`;
  const { auth = false, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers as HeadersInit | undefined);
  headers.set('Accept', 'application/json');

  const hasJsonBody =
    fetchOptions.body &&
    typeof fetchOptions.body === 'object' &&
    !(fetchOptions.body instanceof FormData);

  if (hasJsonBody) {
    headers.set('Content-Type', 'application/json');
    fetchOptions.body = JSON.stringify(fetchOptions.body);
  }

  if (auth) {
    const token = getAuthToken() ?? getDevToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, { ...fetchOptions, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Network error: ${message}`);
  }

  let payload: any = null;
  try {
    payload = await response.clone().json();
  } catch {
    // Non-JSON responses are treated as empty payloads
  }

  if (!response.ok) {
    const apiError = payload?.error;
    const codeOrMessage = apiError?.code || apiError?.message;
    const message = codeOrMessage
      ? `Lune API error (${response.status}): ${codeOrMessage}`
      : `Lune API error (${response.status})`;
    throw new Error(message);
  }

  if (payload !== null) {
    return payload as T;
  }

  return (await response.json()) as T;
}
