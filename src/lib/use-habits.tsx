import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from './auth';
import {
  Challenge,
  Habit,
  LOCAL_SCOPE,
  Store,
  bumpCount,
  challengeProgress,
  emptyStore,
  loadStore,
  newChallenge,
  newHabit,
  nowIso,
  saveStore,
  todayKey,
  toggleBinary,
} from './habits';
import { syncReminders } from './notifications';
import { deleteRemote, mergeStores, pullRemote, pushLocal } from './sync';

type HabitInput = {
  name: string;
  emoji: string;
  type?: Habit['type'];
  target?: number;
  reminderTime?: string | null;
};

type HabitsContextValue = {
  ready: boolean;
  habits: Habit[];
  challenges: Challenge[];
  onboardingComplete: boolean;
  notificationsAsked: boolean;
  activeChallenge: Challenge | null;
  syncing: boolean;
  addHabit: (input: HabitInput) => Habit;
  updateHabit: (id: string, patch: Partial<HabitInput>) => void;
  removeHabit: (id: string) => void;
  toggleBinaryHabit: (id: string) => void;
  bumpHabit: (id: string, delta: number) => void;
  startChallenge: (input: {
    habitId: string;
    title: string;
    days: number;
    rewardEmoji?: string;
  }) => Challenge;
  completeChallenge: (id: string) => void;
  setOnboardingComplete: (v: boolean) => void;
  setNotificationsAsked: (v: boolean) => void;
  getHabit: (id: string) => Habit | undefined;
};

const HabitsContext = createContext<HabitsContextValue | null>(null);

const alive = <T extends { deletedAt: string | null }>(x: T) => !x.deletedAt;

export function HabitsProvider({ children }: { children: ReactNode }) {
  const { userId, loading: authLoading } = useAuth();
  const scope = userId ?? LOCAL_SCOPE;

  const [store, setStore] = useState<Store>(emptyStore());
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const scopeRef = useRef(scope);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextPersist = useRef(true);
  const storeRef = useRef(store);
  const userIdRef = useRef(userId);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Load (and, when signed in, sync) whenever the active scope changes.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setReady(false);
    scopeRef.current = scope;
    skipNextPersist.current = true;

    (async () => {
      let local = await loadStore(scope);

      // First time signing in: adopt anything created while offline/local.
      if (scope !== LOCAL_SCOPE) {
        const localOnly = await loadStore(LOCAL_SCOPE);
        if (localOnly.habits.length || localOnly.challenges.length) {
          local = mergeStores(local, {
            habits: localOnly.habits,
            challenges: localOnly.challenges,
          });
          local.onboardingComplete = local.onboardingComplete || localOnly.onboardingComplete;
        }
      }
      if (cancelled) return;
      setStore(local);
      setReady(true);

      if (userId) {
        setSyncing(true);
        const remote = await pullRemote(userId);
        if (cancelled) {
          setSyncing(false);
          return;
        }
        const merged = mergeStores(local, remote);
        await saveStore(merged, scope);
        setStore(merged);
        await pushLocal(userId, merged);
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scope, userId, authLoading]);

  // Persist locally on every change, and schedule a debounced cloud push.
  useEffect(() => {
    if (!ready) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    const activeScope = scopeRef.current;
    saveStore(store, activeScope).catch(() => {});
    syncReminders(store.habits.filter(alive), store.challenges.filter(alive)).catch(() => {});

    if (userId) {
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => {
        setSyncing(true);
        pushLocal(userId, store).finally(() => setSyncing(false));
      }, 600);
    }
  }, [store, ready, userId]);

  const addHabit = useCallback((input: HabitInput) => {
    const h = newHabit(input);
    setStore((s) => ({ ...s, habits: [...s.habits, h] }));
    return h;
  }, []);

  const updateHabit = useCallback((id: string, patch: Partial<HabitInput>) => {
    setStore((s) => ({
      ...s,
      habits: s.habits.map((h) =>
        h.id === id
          ? {
              ...h,
              name: patch.name?.trim() ?? h.name,
              emoji: patch.emoji ?? h.emoji,
              type: patch.type ?? h.type,
              target:
                (patch.type ?? h.type) === 'count'
                  ? Math.max(1, patch.target ?? h.target)
                  : 1,
              reminderTime:
                patch.reminderTime === undefined ? h.reminderTime : patch.reminderTime,
              updatedAt: nowIso(),
            }
          : h,
      ),
    }));
  }, []);

  const removeHabit = useCallback((id: string) => {
    const childIds = storeRef.current.challenges
      .filter((c) => c.habitId === id)
      .map((c) => c.id);
    setStore((s) => ({
      ...s,
      habits: s.habits.filter((h) => h.id !== id),
      challenges: s.challenges.filter((c) => c.habitId !== id),
    }));
    const uid = userIdRef.current;
    if (uid) {
      deleteRemote(uid, 'habits', [id]).catch(() => {});
      deleteRemote(uid, 'challenges', childIds).catch(() => {});
    }
  }, []);

  const toggleBinaryHabit = useCallback((id: string) => {
    setStore((s) => ({
      ...s,
      habits: s.habits.map((h) => (h.id === id ? toggleBinary(h) : h)),
    }));
  }, []);

  const bumpHabit = useCallback((id: string, delta: number) => {
    setStore((s) => ({
      ...s,
      habits: s.habits.map((h) => (h.id === id ? bumpCount(h, delta) : h)),
    }));
  }, []);

  const startChallenge = useCallback(
    (input: { habitId: string; title: string; days: number; rewardEmoji?: string }) => {
      const c = newChallenge(input);
      setStore((s) => ({ ...s, challenges: [...s.challenges, c] }));
      return c;
    },
    [],
  );

  const completeChallenge = useCallback((id: string) => {
    setStore((s) => ({
      ...s,
      challenges: s.challenges.map((c) =>
        c.id === id && !c.completedAt
          ? { ...c, completedAt: todayKey(), updatedAt: nowIso() }
          : c,
      ),
    }));
  }, []);

  const setOnboardingComplete = useCallback((v: boolean) => {
    setStore((s) => ({ ...s, onboardingComplete: v }));
  }, []);

  const setNotificationsAsked = useCallback((v: boolean) => {
    setStore((s) => ({ ...s, notificationsAsked: v }));
  }, []);

  const habits = useMemo(() => store.habits.filter(alive), [store.habits]);
  const challenges = useMemo(() => store.challenges.filter(alive), [store.challenges]);

  const getHabit = useCallback((id: string) => habits.find((h) => h.id === id), [habits]);

  const activeChallenge = useMemo(() => {
    const open = challenges.filter((c) => !c.completedAt);
    return open.length ? open[0] : null;
  }, [challenges]);

  const value: HabitsContextValue = {
    ready,
    habits,
    challenges,
    onboardingComplete: store.onboardingComplete,
    notificationsAsked: store.notificationsAsked,
    activeChallenge,
    syncing,
    addHabit,
    updateHabit,
    removeHabit,
    toggleBinaryHabit,
    bumpHabit,
    startChallenge,
    completeChallenge,
    setOnboardingComplete,
    setNotificationsAsked,
    getHabit,
  };

  return <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>;
}

export function useHabits(): HabitsContextValue {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error('useHabits must be used inside <HabitsProvider>');
  return ctx;
}

export function useChallengeProgress(challenge: Challenge | null) {
  const { getHabit } = useHabits();
  return useMemo(() => {
    if (!challenge) return null;
    return { ...challengeProgress(challenge, getHabit(challenge.habitId)), challenge };
  }, [challenge, getHabit]);
}
