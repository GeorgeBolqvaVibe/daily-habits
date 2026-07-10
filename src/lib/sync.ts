import { Challenge, Habit, Store } from './habits';
import { supabase } from './supabase';

/**
 * Offline-first sync. The local AsyncStorage store is always the UI's source
 * of truth. These helpers push the local state up and pull remote state down,
 * reconciling per-row by `updatedAt` (last-write-wins). All writes are upserts
 * keyed by the entity id, so pushing the full current state repeatedly is
 * idempotent and safe to retry after being offline.
 */

type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  type: string;
  target: number;
  reminder_time: string | null;
  created_at: string;
  completions: Record<string, number>;
  updated_at: string;
  deleted_at: string | null;
};

type ChallengeRow = {
  id: string;
  user_id: string;
  title: string;
  habit_id: string;
  days: number;
  start_date: string;
  completed_at: string | null;
  reward_emoji: string;
  updated_at: string;
  deleted_at: string | null;
};

function habitToRow(userId: string, h: Habit): HabitRow {
  return {
    id: h.id,
    user_id: userId,
    name: h.name,
    emoji: h.emoji,
    type: h.type,
    target: h.target,
    reminder_time: h.reminderTime,
    created_at: h.createdAt,
    completions: h.completions,
    updated_at: h.updatedAt,
    deleted_at: h.deletedAt,
  };
}

function rowToHabit(r: HabitRow): Habit {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    type: r.type === 'count' ? 'count' : 'binary',
    target: r.target,
    reminderTime: r.reminder_time,
    createdAt: r.created_at,
    completions: r.completions ?? {},
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

function challengeToRow(userId: string, c: Challenge): ChallengeRow {
  return {
    id: c.id,
    user_id: userId,
    title: c.title,
    habit_id: c.habitId,
    days: c.days,
    start_date: c.startDate,
    completed_at: c.completedAt,
    reward_emoji: c.rewardEmoji,
    updated_at: c.updatedAt,
    deleted_at: c.deletedAt,
  };
}

function rowToChallenge(r: ChallengeRow): Challenge {
  return {
    id: r.id,
    title: r.title,
    habitId: r.habit_id,
    days: r.days,
    startDate: r.start_date,
    completedAt: r.completed_at,
    rewardEmoji: r.reward_emoji,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

function mergeById<T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) {
    const existing = map.get(item.id);
    if (!existing || item.updatedAt >= existing.updatedAt) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export type PullResult = { habits: Habit[]; challenges: Challenge[] } | null;

export async function pullRemote(userId: string): Promise<PullResult> {
  if (!supabase) return null;
  try {
    const [h, c] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', userId),
      supabase.from('challenges').select('*').eq('user_id', userId),
    ]);
    if (h.error || c.error) return null;
    return {
      habits: (h.data as HabitRow[]).map(rowToHabit),
      challenges: (c.data as ChallengeRow[]).map(rowToChallenge),
    };
  } catch {
    return null;
  }
}

/** Hard-delete rows by id for this user (used when a habit is removed). */
export async function deleteRemote(
  userId: string,
  table: 'habits' | 'challenges',
  ids: string[],
): Promise<boolean> {
  if (!supabase || ids.length === 0) return true;
  try {
    const { error } = await supabase.from(table).delete().eq('user_id', userId).in('id', ids);
    return !error;
  } catch {
    return false;
  }
}

export async function pushLocal(userId: string, store: Store): Promise<boolean> {
  if (!supabase) return false;
  try {
    const habitRows = store.habits.map((h) => habitToRow(userId, h));
    const challengeRows = store.challenges.map((c) => challengeToRow(userId, c));
    const ops: Promise<{ error: unknown }>[] = [];
    if (habitRows.length) ops.push(supabase.from('habits').upsert(habitRows) as never);
    if (challengeRows.length) ops.push(supabase.from('challenges').upsert(challengeRows) as never);
    if (ops.length === 0) return true;
    const results = await Promise.all(ops);
    return results.every((r) => !r.error);
  } catch {
    return false;
  }
}

/** Merge a local store with what's on the server, keeping local device prefs. */
export function mergeStores(local: Store, remote: PullResult): Store {
  if (!remote) return local;
  return {
    habits: mergeById(local.habits, remote.habits),
    challenges: mergeById(local.challenges, remote.challenges),
    onboardingComplete: local.onboardingComplete,
    notificationsAsked: local.notificationsAsked,
  };
}
