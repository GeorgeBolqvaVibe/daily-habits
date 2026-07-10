import Constants, { ExecutionEnvironment } from 'expo-constants';

import type * as NotificationsType from 'expo-notifications';
import {
  Challenge,
  Habit,
  addDays,
  daysBetween,
  isDoneForDay,
  todayKey,
} from './habits';

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let cached: typeof NotificationsType | null = null;
let loadAttempted = false;
let handlerConfigured = false;

function loadNotifications(): typeof NotificationsType | null {
  if (loadAttempted) return cached;
  loadAttempted = true;
  if (IS_EXPO_GO) return null;
  try {
    cached = require('expo-notifications');
  } catch {
    cached = null;
  }
  return cached;
}

function configureHandler(N: typeof NotificationsType) {
  if (handlerConfigured) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  } catch {}
}

export function notificationsSupported(): boolean {
  return loadNotifications() !== null;
}

export async function requestAndSetupNotifications(): Promise<boolean> {
  const N = loadNotifications();
  if (!N) return false;
  configureHandler(N);
  try {
    const cur = await N.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    const req = await N.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

async function hasPermission(N: typeof NotificationsType): Promise<boolean> {
  try {
    const p = await N.getPermissionsAsync();
    return p.granted;
  } catch {
    return false;
  }
}

function parseHM(s: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return {
    hour: Math.max(0, Math.min(23, Number(m[1]))),
    minute: Math.max(0, Math.min(59, Number(m[2]))),
  };
}

export async function syncReminders(
  habits: Habit[],
  challenges: Challenge[],
): Promise<void> {
  const N = loadNotifications();
  if (!N) return;
  if (!(await hasPermission(N))) return;

  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch {}

  for (const h of habits) {
    if (!h.reminderTime) continue;
    const hm = parseHM(h.reminderTime);
    if (!hm) continue;
    try {
      await N.scheduleNotificationAsync({
        content: {
          title: `${h.emoji} ${h.name}`,
          body:
            h.type === 'count'
              ? `Log ${h.target}× today. Don't lose your streak!`
              : `Time for ${h.name}. Tap to check it off.`,
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DAILY,
          hour: hm.hour,
          minute: hm.minute,
        },
      });
    } catch {}
  }

  const today = todayKey();
  for (const c of challenges) {
    if (c.completedAt) continue;
    const habit = habits.find((h) => h.id === c.habitId);
    if (!habit) continue;
    const endsOn = addDays(c.startDate, c.days - 1);
    const daysLeft = daysBetween(today, endsOn);
    if (daysLeft < 0) continue;
    if (isDoneForDay(habit)) continue;
    try {
      await N.scheduleNotificationAsync({
        content: {
          title: `🎯 ${c.title}`,
          body: `Keep the challenge alive — ${daysLeft === 0 ? 'last day!' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}`,
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DAILY,
          hour: 20,
          minute: 30,
        },
      });
    } catch {}
  }
}
