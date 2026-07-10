import type { Session } from '@supabase/supabase-js';
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getAuthSkipped, setAuthSkipped } from './prefs';
import { isSupabaseConfigured, supabase } from './supabase';

type AuthResult = { error: string | null };

type AuthContextValue = {
  /** Whether cloud auth is even available (env configured). */
  enabled: boolean;
  /** Still restoring the persisted session / skip flag. */
  loading: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;
  /** User chose to use the app offline without an account. */
  skipped: boolean;
  skipAuth: () => void;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    getAuthSkipped().then(setSkipped);
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        // A real session supersedes an earlier "skip".
        setSkipped(false);
        setAuthSkipped(false).catch(() => {});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      enabled: isSupabaseConfigured,
      loading,
      session,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      skipped,
      skipAuth() {
        setSkipped(true);
        setAuthSkipped(true).catch(() => {});
      },
      async signUp(email, password) {
        if (!supabase) return { error: 'Cloud sync is not configured.' };
        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error?.message ?? null };
      },
      async signIn(email, password) {
        if (!supabase) return { error: 'Cloud sync is not configured.' };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
    }),
    [loading, session, skipped],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
