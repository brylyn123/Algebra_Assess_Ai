import { API_BASE_URL } from './apiBase';

let cachedToken = null;
let pendingRequest = null;

export async function getCsrfToken() {
  if (cachedToken) return cachedToken;

  if (pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/csrf_token.php`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (data.status === 'success' && data.csrf_token) {
        cachedToken = data.csrf_token;
        return cachedToken;
      }
    } catch (e) {
      console.error('Failed to fetch CSRF token:', e);
    }
    return null;
  })();

  try {
    return await pendingRequest;
  } finally {
    pendingRequest = null;
  }
}

export function clearCsrfToken() {
  cachedToken = null;
}
