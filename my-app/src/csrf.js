import { API_BASE_URL } from './apiBase';

let cachedToken = null;

export async function getCsrfToken() {
  if (cachedToken) return cachedToken;

  try {
    const res = await fetch(`${API_BASE_URL}/csrf_token.php`, {
      credentials: 'include',
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
}

export function clearCsrfToken() {
  cachedToken = null;
}
