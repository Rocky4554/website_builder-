/**
 * Auth token handoff.
 *
 * This UI does not mint tokens — the host app (Spring Boot) does. A real token
 * reaches the browser one of three ways, checked in this order:
 *
 *   1. `?token=<jwt>` on any URL. The host app redirects here with the token
 *      appended; we persist it and strip it from the address bar immediately so
 *      it never lingers in history, referrers, or server access logs.
 *   2. `localStorage["wb_auth_token"]`, persisted from a previous handoff, or
 *      set directly by a host page that embeds this UI (see `setAuthToken`).
 *   3. `NEXT_PUBLIC_DEV_AUTH_TOKEN` — local development only. The backend
 *      accepts the literal "dev-token" when `APP_ENV=dev`.
 */

const STORAGE_KEY = "wb_auth_token";
const DEV_FALLBACK = process.env.NEXT_PUBLIC_DEV_AUTH_TOKEN || "dev-token";

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Consume a `?token=` handoff, persist it, and scrub it from the URL. */
function consumeUrlToken(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  if (!token) return null;

  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Private browsing / blocked storage: the token still works for this page load.
  }
  url.searchParams.delete("token");
  window.history.replaceState({}, "", url.toString());
  return token;
}

export function getAuthToken(): string {
  return consumeUrlToken() || readStored() || DEV_FALLBACK;
}

/** Set the token explicitly — for a host page embedding this UI. */
export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Non-fatal; callers fall back to the dev token.
  }
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}

/** True when no real token was handed over and we're running on the dev fallback. */
export function isUsingDevToken(): boolean {
  return getAuthToken() === DEV_FALLBACK && !readStored();
}

export function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getAuthToken()}` };
}
