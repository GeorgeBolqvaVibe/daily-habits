import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_SKIPPED_KEY = 'prefs.authSkipped';

export async function getAuthSkipped(): Promise<boolean> {
  return (await AsyncStorage.getItem(AUTH_SKIPPED_KEY)) === '1';
}

export async function setAuthSkipped(v: boolean): Promise<void> {
  if (v) await AsyncStorage.setItem(AUTH_SKIPPED_KEY, '1');
  else await AsyncStorage.removeItem(AUTH_SKIPPED_KEY);
}
