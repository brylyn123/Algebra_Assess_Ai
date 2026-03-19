const LOCAL_USERS_KEY = 'aa_local_users';
const CURRENT_USER_KEY = 'aa_current_user_email';

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const readStoredUsers = () => {
  const raw = localStorage.getItem(LOCAL_USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const findLocalUser = (email) => {
  const target = normalizeEmail(email);
  return readStoredUsers().find((user) => normalizeEmail(user.email) === target);
};

export const storeLocalUser = (user) => {
    if (!user?.email) return;
    const normalized = {
        ...user,
        email: normalizeEmail(user.email),
    };
    const users = readStoredUsers().filter((entry) => normalizeEmail(entry.email) !== normalized.email);
    users.push(normalized);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    localStorage.setItem(CURRENT_USER_KEY, normalized.email);
};

export const setCurrentLocalUserEmail = (email) => {
    if (!email) return;
    localStorage.setItem(CURRENT_USER_KEY, normalizeEmail(email));
};

export const getCurrentLocalUserEmail = () => {
    const email = localStorage.getItem(CURRENT_USER_KEY);
    return email ? normalizeEmail(email) : null;
};

export const clearCurrentLocalUserEmail = () => {
    localStorage.removeItem(CURRENT_USER_KEY);
};
