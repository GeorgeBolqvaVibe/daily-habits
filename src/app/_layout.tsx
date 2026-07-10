import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { RewardModal } from '@/components/reward-modal';
import { challengeProgress } from '@/lib/habits';
import { FeedbackProvider, useFeedback } from '@/lib/feedback';
import { HabitsProvider, useHabits } from '@/lib/use-habits';

SplashScreen.preventAutoHideAsync();

function OnboardingGate() {
  const { ready, onboardingComplete } = useHabits();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const first = segments[0] as string | undefined;
    const inOnboarding = first === 'onboarding';
    if (!onboardingComplete && !inOnboarding) {
      router.replace('/onboarding');
    } else if (onboardingComplete && inOnboarding) {
      router.replace('/');
    }
  }, [ready, onboardingComplete, segments, router]);

  return null;
}

function RewardWatcher() {
  const { challenges, getHabit, completeChallenge } = useHabits();
  const feedback = useFeedback();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingEmoji, setPendingEmoji] = useState('🏆');
  const [pendingDays, setPendingDays] = useState(3);
  const [pendingTitle, setPendingTitle] = useState('');

  useEffect(() => {
    if (pendingId) return;
    for (const c of challenges) {
      if (c.completedAt) continue;
      const habit = getHabit(c.habitId);
      const p = challengeProgress(c, habit);
      if (p.complete) {
        setPendingId(c.id);
        setPendingEmoji(habit?.emoji ?? c.rewardEmoji);
        setPendingDays(c.days);
        setPendingTitle(c.title);
        feedback.fire('complete');
        break;
      }
    }
  }, [challenges, getHabit, feedback, pendingId]);

  function handleClaim() {
    if (pendingId) completeChallenge(pendingId);
    setPendingId(null);
  }

  return (
    <RewardModal
      visible={!!pendingId}
      onClaim={handleClaim}
      emoji={pendingEmoji}
      days={pendingDays}
      title="Challenge complete!"
      subtitle={pendingTitle}
    />
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <HabitsProvider>
        <FeedbackProvider>
          <OnboardingGate />
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            <Stack.Screen
              name="habits/new"
              options={{ presentation: 'modal', headerShown: true, title: 'New habit' }}
            />
            <Stack.Screen
              name="habits/[id]"
              options={{ headerShown: true, title: 'Habit' }}
            />
          </Stack>
          <RewardWatcher />
        </FeedbackProvider>
      </HabitsProvider>
    </ThemeProvider>
  );
}
