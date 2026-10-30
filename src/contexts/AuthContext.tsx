import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, tokenStore } from '@/lib/api';
import type { Meta, User } from '@/lib/types';

interface AuthValue {
  user: User | null;
  meta: Meta | null;
  unread: number;
  loading: boolean;
  settings: Record<string, string>;
  visibility: string;
  login: (identifier: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  setUnread: (value: number) => void;
  setMeta: (meta: Meta) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

interface MeResponse {
  user: User;
  unreadNotifications: number;
  settings: Record<string, string>;
  visibility: string;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [unread, setUnread] = useState(0);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState('');
  const [loading, setLoading] = useState(true);
  const metaLoaded = useRef(false);

  const loadMeta = useCallback(async () => {
    if (metaLoaded.current) return;
    try {
      const data = await api.get<Meta>('/api/meta');
      setMeta(data);
      metaLoaded.current = true;
    } catch {
      /* meta is non-critical */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<MeResponse>('/api/auth/me');
      setUser(me.user);
      setUnread(me.unreadNotifications);
      setSettings(me.settings);
      setVisibility(me.visibility);
      void loadMeta();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [loadMeta]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => {
      setUser(null);
      setUnread(0);
    };
    window.addEventListener('sentinel:unauthorized', handler);
    return () => window.removeEventListener('sentinel:unauthorized', handler);
  }, []);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const data = await api.post<{ user: User; token: string; settings: Record<string, string> }>('/api/auth/login', {
        identifier,
        password,
      });
      tokenStore.set(data.token);
      setUser(data.user);
      setSettings(data.settings ?? {});
      setLoading(false);
      void loadMeta();
      try {
        const me = await api.get<MeResponse>('/api/auth/me');
        setUnread(me.unreadNotifications);
        setVisibility(me.visibility);
      } catch {
        /* ignore */
      }
      return data.user;
    },
    [loadMeta],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      /* session may already be gone */
    }
    tokenStore.clear();
    setUser(null);
    setUnread(0);
    metaLoaded.current = false;
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      const data = await api.get<{ unread: number }>('/api/notifications/unread-count');
      setUnread(data.unread);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      meta,
      unread,
      loading,
      settings,
      visibility,
      login,
      logout,
      refresh,
      refreshUnread,
      setUnread,
      setMeta,
    }),
    [user, meta, unread, loading, settings, visibility, login, logout, refresh, refreshUnread],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === 'admin';
}
