import { API_BASE_URL } from './apiBase';
import { storeLocalUser, setCurrentLocalUserEmail } from './localAuthStore';

export async function fetchSession() {
  const response = await fetch(`${API_BASE_URL}/session.php`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const text = await response.text();
  let payload;

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Unable to verify session: unexpected server response.');
  }

  if (!response.ok || payload.status !== 'success' || !payload.user) {
    throw new Error(payload.message || 'Please log in again.');
  }

  const user = payload.user;
  if (user?.email) {
    storeLocalUser(user);
    setCurrentLocalUserEmail(user.email);
  }

  return user;
}

export function isRoleAllowed(role, allowedRoles = []) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return true;
  }

  const normalizedRole = String(role || '').toLowerCase();
  return allowedRoles.some((allowed) => String(allowed || '').toLowerCase() === normalizedRole);
}
