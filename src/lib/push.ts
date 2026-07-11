import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as NotificationsType from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Push tokens can't be obtained from Expo Go on Android (SDK 53+ removed the
 * native module) and shouldn't be obtained on web. We probe safely instead of
 * static-importing expo-notifications, which crashes at module load in Expo Go.
 */
function loadNotifications(): typeof NotificationsType | null {
  if (Platform.OS === 'web') return null;
  if (IS_EXPO_GO && Platform.OS === 'android') return null;
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

export async function registerPushToken(userId: string): Promise<{
  token: string | null;
  reason?: string;
}> {
  if (!supabase) return { token: null, reason: 'Cloud sync not configured' };
  const N = loadNotifications();
  if (!N) {
    return {
      token: null,
      reason:
        Platform.OS === 'web'
          ? 'Web: push not supported'
          : 'Expo Go on Android: push requires a dev build',
    };
  }

  try {
    const cur = await N.getPermissionsAsync();
    let granted = cur.granted;
    if (!granted && cur.canAskAgain) {
      const req = await N.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return { token: null, reason: 'Permission denied' };

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
        ?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const tokenResp = await N.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResp.data;
    if (!token) return { token: null, reason: 'No token returned' };

    await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' },
      );

    return { token };
  } catch (e) {
    return { token: null, reason: String(e).slice(0, 200) };
  }
}
