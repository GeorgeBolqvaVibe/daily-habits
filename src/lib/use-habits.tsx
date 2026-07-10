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

import {
  Challenge,
  Habit,
  Store,
  bumpCount,
  challengeProgress,
  loadStore,
  newChallenge,
  newHabit,
  saveStore,
  todayKey,
  toggleBinary,
} from './habits';
import { syncReminders } from './notifications';

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

export function HabitsProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>({
    habits: [],
    challenges: [],
    onboardingComplete: false,
    notificationsAsked: false,
  });
  const [ready, setReady] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    loadStore().then((s) => {
      setStore(s);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    saveStore(store).catch(() => {});
    syncReminders(store.habits, store.challenges).catch(() => {});
  }, [store, ready]);

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
            }
          : h,
      ),
    }));
  }, []);

  const removeHabit = useCallback((id: string) => {
    setStore((s) => ({
      ...s,
      habits: s.habits.filter((h) => h.id !== id),
      challenges: s.challenges.filter((c) => c.habitId !== id),
    }));
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
        c.id === id && !c.completedAt ? { ...c, completedAt: todayKey() } : c,
      ),
    }));
  }, []);

  const setOnboardingComplete = useCallback((v: boolean) => {
    setStore((s) => ({ ...s, onboardingComplete: v }));
  }, []);

  const setNotificationsAsked = useCallback((v: boolean) => {
    setStore((s) => ({ ...s, notificationsAsked: v }));
  }, []);

  const getHabit = useCallback(
    (id: string) => store.habits.find((h) => h.id === id),
    [store.habits],
  );

  const activeChallenge = useMemo(() => {
    const open = store.challenges.filter((c) => !c.completedAt);
    if (open.length === 0) return null;
    return open[0];
  }, [store.challenges]);

  const value: HabitsContextValue = {
    ready,
    habits: store.habits,
    challenges: store.challenges,
    onboardingComplete: store.onboardingComplete,
    notificationsAsked: store.notificationsAsked,
    activeChallenge,
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
