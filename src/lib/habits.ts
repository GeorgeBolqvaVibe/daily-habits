import AsyncStorage from '@react-native-async-storage/async-storage';

export type HabitType = 'binary' | 'count';

export type Habit = {
  id: string;
  name: string;
  emoji: string;
  type: HabitType;
  target: number;
  reminderTime: string | null;
  createdAt: string;
  completions: Record<string, number>;
};

export type Challenge = {
  id: string;
  title: string;
  habitId: string;
  days: number;
  startDate: string;
  completedAt: string | null;
  rewardEmoji: string;
};

export type Store = {
  habits: Habit[];
  challenges: Challenge[];
  onboardingComplete: boolean;
  notificationsAsked: boolean;
};

const STORAGE_KEY = 'habits.v2';
const LEGACY_KEY = 'habits.v1';

export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return todayKey(dt);
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.round((db - da) / 86400000);
}

export function dayCount(habit: Habit, date: string = todayKey()): number {
  return habit.completions[date] ?? 0;
}

export function isDoneForDay(habit: Habit, date: string = todayKey()): boolean {
  const c = dayCount(habit, date);
  return habit.type === 'binary' ? c > 0 : c >= habit.target;
}

export function progress(habit: Habit, date: string = todayKey()): number {
  if (habit.type === 'binary') return isDoneForDay(habit, date) ? 1 : 0;
  return Math.min(1, dayCount(habit, date) / Math.max(1, habit.target));
}

export function currentStreak(habit: Habit, today: string = todayKey()): number {
  let cursor = isDoneForDay(habit, today) ? today : addDays(today, -1);
  let streak = 0;
  while (isDoneForDay(habit, cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function bestStreak(habit: Habit): number {
  const doneDates = Object.entries(habit.completions)
    .filter(([, v]) => (habit.type === 'binary' ? v > 0 : v >= habit.target))
    .map(([d]) => d)
    .sort();
  if (doneDates.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < doneDates.length; i++) {
    if (daysBetween(doneDates[i - 1], doneDates[i]) === 1) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

export function totalDoneDays(habit: Habit): number {
  return Object.entries(habit.completions).filter(([, v]) =>
    habit.type === 'binary' ? v > 0 : v >= habit.target,
  ).length;
}

export function dayCountsForRange(habit: Habit, days: number): number[] {
  const out: number[] = [];
  const today = todayKey();
  for (let i = days - 1; i >= 0; i--) {
    out.push(dayCount(habit, addDays(today, -i)));
  }
  return out;
}

export function toggleBinary(habit: Habit, date: string = todayKey()): Habit {
  const next = { ...habit.completions };
  if ((next[date] ?? 0) > 0) delete next[date];
  else next[date] = 1;
  return { ...habit, completions: next };
}

export function bumpCount(habit: Habit, delta: number, date: string = todayKey()): Habit {
  const next = { ...habit.completions };
  const cur = next[date] ?? 0;
  const nv = Math.max(0, cur + delta);
  if (nv === 0) delete next[date];
  else next[date] = nv;
  return { ...habit, completions: next };
}

export function newHabit(input: {
  name: string;
  emoji: string;
  type?: HabitType;
  target?: number;
  reminderTime?: string | null;
}): Habit {
  const type = input.type ?? 'binary';
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    emoji: input.emoji.trim() || '⭐',
    type,
    target: type === 'count' ? Math.max(1, input.target ?? 3) : 1,
    reminderTime: input.reminderTime ?? null,
    createdAt: new Date().toISOString(),
    completions: {},
  };
}

export function newChallenge(input: {
  habitId: string;
  title: string;
  days: number;
  rewardEmoji?: string;
}): Challenge {
  return {
    id: `ch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    habitId: input.habitId,
    title: input.title,
    days: input.days,
    startDate: todayKey(),
    completedAt: null,
    rewardEmoji: input.rewardEmoji ?? '🏆',
  };
}

export function challengeProgress(
  challenge: Challenge,
  habit: Habit | undefined
): { done: number; needed: number; ratio: number; complete: boolean } {
  const needed = challenge.days;
  if (!habit) return { done: 0, needed, ratio: 0, complete: false };
  let done = 0;
  for (let i = 0; i < needed; i++) {
    const day = addDays(challenge.startDate, i);
    if (daysBetween(day, todayKey()) < 0) break;
    if (isDoneForDay(habit, day)) done += 1;
  }
  return { done, needed, ratio: done / needed, complete: done >= needed };
}

async function migrateV1(): Promise<Habit[] | null> {
  const raw = await AsyncStorage.getItem(LEGACY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Array<{
      id: string;
      name: string;
      emoji: string;
      createdAt: string;
      completions: string[];
    }>;
    return parsed.map((h) => ({
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      type: 'binary' as const,
      target: 1,
      reminderTime: null,
      createdAt: h.createdAt,
      completions: Object.fromEntries((h.completions ?? []).map((d) => [d, 1])),
    }));
  } catch {
    return null;
  }
}

function normalizeStore(s: Partial<Store>): Store {
  return {
    habits: Array.isArray(s.habits) ? s.habits : [],
    challenges: Array.isArray(s.challenges) ? s.challenges : [],
    onboardingComplete: !!s.onboardingComplete,
    notificationsAsked: !!s.notificationsAsked,
  };
}

export async function loadStore(): Promise<Store> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return normalizeStore(JSON.parse(raw));
    } catch {}
  }
  const migrated = await migrateV1();
  if (migrated) {
    await AsyncStorage.removeItem(LEGACY_KEY);
    return normalizeStore({ habits: migrated });
  }
  return { habits: [], challenges: [], onboardingComplete: false, notificationsAsked: false };
}

export async function saveStore(store: Store): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export const STARTER_HABITS: Array<Omit<Habit, 'id' | 'createdAt' | 'completions'>> = [
  { name: 'Drink water', emoji: '💧', type: 'count', target: 6, reminderTime: '09:00' },
  { name: 'Read 10 pages', emoji: '📚', type: 'binary', target: 1, reminderTime: '20:00' },
  { name: 'Walk 30 min', emoji: '🚶', type: 'binary', target: 1, reminderTime: '18:00' },
  { name: 'Meditate', emoji: '🧘', type: 'binary', target: 1, reminderTime: '07:30' },
  { name: 'Stretch', emoji: '🤸', type: 'count', target: 2, reminderTime: '12:00' },
];
