// Session token storage for the web app.
//
// The frontend (www.desipartyvibes.com) and API (a separate Railway domain)
// are on different origins. The API also sets a `session_token` httpOnly
// cookie, but browsers increasingly restrict or block cookies set by a
// cross-site fetch/XHR response ("third-party cookie" blocking), which can
// silently drop the session even though login/verify succeeded. To make
// auth work reliably regardless of the browser's cookie policy, the API
// also returns the token in the response body; we store it here and send
// it as an `Authorization: Bearer <token>` header on every request via
// `setAuthTokenGetter` (wired up in main.tsx).
const STORAGE_KEY = "dpv_session_token";

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage can throw in some contexts (e.g. private browsing with
    // storage disabled). Fall back to cookie-only auth in that case.
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore — nothing we can do if storage is unavailable.
  }
}
