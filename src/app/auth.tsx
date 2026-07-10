import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Palette, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { signIn, signUp, skipAuth } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    if (mode === 'signup') {
      // If email confirmation is on, there's no session yet.
      setNotice('Account created. If asked, confirm via email, then sign in.');
      setMode('signin');
      return;
    }
    // The auth listener + gate will route us onward on success.
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled">
            <ThemedText style={styles.logo}>🌱</ThemedText>
            <ThemedText type="title" style={{ textAlign: 'center' }}>
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: palette.textSecondary, textAlign: 'center' }}>
              {mode === 'signin'
                ? 'Sign in to sync your habits across devices.'
                : 'Sign up to back up and sync your habits.'}
            </ThemedText>

            <View style={{ gap: Spacing.two, alignSelf: 'stretch', marginTop: Spacing.two }}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={palette.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                style={[styles.input, inputStyle(palette)]}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password (min 6 chars)"
                placeholderTextColor={palette.textSecondary}
                secureTextEntry
                textContentType="password"
                onSubmitEditing={submit}
                style={[styles.input, inputStyle(palette)]}
              />
            </View>

            {error && (
              <ThemedText type="small" style={{ color: '#d64545', textAlign: 'center' }}>
                {error}
              </ThemedText>
            )}
            {notice && (
              <ThemedText type="small" style={{ color: palette.textSecondary, textAlign: 'center' }}>
                {notice}
              </ThemedText>
            )}

            <Pressable
              onPress={submit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: palette.text, opacity: !canSubmit ? 0.4 : pressed ? 0.85 : 1 },
              ]}>
              {busy ? (
                <ActivityIndicator color={palette.background} />
              ) : (
                <ThemedText style={{ color: palette.background, fontWeight: '700', fontSize: 16 }}>
                  {mode === 'signin' ? 'Sign in' : 'Sign up'}
                </ThemedText>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                setError(null);
                setNotice(null);
              }}>
              <ThemedText type="small" style={{ color: palette.textSecondary, textAlign: 'center' }}>
                {mode === 'signin'
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => {
                skipAuth();
                router.replace('/');
              }}
              style={{ marginTop: Spacing.two }}>
              <ThemedText type="small" style={{ color: palette.textSecondary, textAlign: 'center' }}>
                Skip — use offline only
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function inputStyle(palette: Palette) {
  return {
    color: palette.text,
    backgroundColor: palette.backgroundElement,
    borderColor: palette.backgroundSelected,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.five,
  },
  logo: { fontSize: 72, lineHeight: 84, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  primary: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
});
