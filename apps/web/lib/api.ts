const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export function getSessionToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem("hosting_session");
}

export function setSessionToken(token: string) {
  localStorage.setItem("hosting_session", token);
}

export function clearSessionToken() {
  localStorage.removeItem("hosting_session");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getSessionToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function authStartUrl() {
  const callback = `${window.location.origin}/auth/callback`;
  return `${apiBaseUrl}/auth/github/start?redirectTo=${encodeURIComponent(callback)}`;
}

