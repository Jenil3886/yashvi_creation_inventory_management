import { create } from 'zustand';

interface User {
  id: string;
  displayName: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  userId: string | null; // Stored user handle for WebAuthn
  isInitialized: boolean;
  appLocked: boolean;
  bootstrap: () => void;
  setAuth: (token: string, user: User) => void;
  setRegisteredUserId: (userId: string) => void;
  lock: () => void;
  unlock: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  userId: null,
  isInitialized: false,
  appLocked: false,

  bootstrap: () => {
    const token = localStorage.getItem('yc_token');
    const userJson = localStorage.getItem('yc_user');
    const userId = localStorage.getItem('yc_user_id');
    const appLockSetting = localStorage.getItem('yc_app_lock_enabled') === 'true';

    let user: User | null = null;
    if (userJson) {
      try {
        user = JSON.parse(userJson);
      } catch {
        user = null;
      }
    }

    set({
      token,
      user,
      userId,
      appLocked: token && appLockSetting ? true : false, // Lock app if logged in and lock is enabled
      isInitialized: true,
    });
  },

  setAuth: (token: string, user: User) => {
    localStorage.setItem('yc_token', token);
    localStorage.setItem('yc_user', JSON.stringify(user));
    localStorage.setItem('yc_user_id', user.id);
    set({ token, user, userId: user.id, appLocked: false });
  },

  setRegisteredUserId: (userId: string) => {
    localStorage.setItem('yc_user_id', userId);
    set({ userId });
  },

  lock: () => {
    set({ appLocked: true });
  },

  unlock: () => {
    set({ appLocked: false });
  },

  logout: () => {
    localStorage.removeItem('yc_token');
    localStorage.removeItem('yc_user');
    set({ token: null, user: null, appLocked: false });
  },
}));

export default useAuthStore;
