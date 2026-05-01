// Tokens persisted in localStorage so they survive a page reload.
// Real production apps should consider httpOnly cookies for refresh tokens;
// this is a demo trade-off favouring simplicity.

const ACCESS_KEY = 'lambder.accessToken';
const REFRESH_KEY = 'lambder.refreshToken';

export const tokenStorage = {
  getAccess: (): string | null => localStorage.getItem(ACCESS_KEY),
  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  setTokens: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
