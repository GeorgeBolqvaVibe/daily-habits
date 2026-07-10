import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Palette, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { requestAndSetupNotifications } from '@/lib/notifications';
import { STARTER_HABITS } from '@/lib/habits';
import { useFeedback } from '@/lib/feedback';
import { useHabits } from '@/lib/use-habits';

type Step = 'intro' | 'pick' | 'reminder' | 'ready';

export default function Onboarding() {
  const router = useRouter();
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const feedback = useFeedback();
  const {
    addHabit,
    startChallenge,
    setOnboardingComplete,
    setNotificationsAsked,
  } = useHabits();

  const [step, setStep] = useState<Step>('intro');
  const [picked, setPicked] = useState<number>(0);
  const [reminderTime, setReminderTime] = useState<string | null>(
    STARTER_HABITS[0].reminderTime,
  );

  function finish() {
    const template = STARTER_HABITS[picked];
    const habit = addHabit({
      name: template.name,
      emoji: template.emoji,
      type: template.type,
      target: template.target,
      reminderTime,
    });
    startChallenge({
      habitId: habit.id,
      title: `3-day ${habit.name} challenge`,
      days: 3,
      rewardEmoji: '🏆',
    });
    setOnboardingComplete(true);
    feedback.fire('complete');
    router.replace('/');
  }

  async function askForNotifications() {
    const granted = await requestAndSetupNotifications();
    setNotificationsAsked(true);
    if (!granted) setReminderTime(null);
    setStep('ready');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {step === 'intro' && (
            <View style={styles.slide}>
              <ThemedText style={styles.hugeEmoji}>🌱</ThemedText>
              <ThemedText type="title" style={{ textAlign: 'center' }}>
                Small habits.{'\n'}Big changes.
              </ThemedText>
              <ThemedText
                style={{ color: palette.textSecondary, textAlign: 'center', fontSize: 16, lineHeight: 22 }}>
                Pick one habit. Show up for three days. Earn a reward. That's it.
              </ThemedText>
              <PrimaryButton onPress={() => setStep('pick')} palette={palette}>
                Get started
              </PrimaryButton>
            </View>
          )}

          {step === 'pick' && (
            <View style={styles.slide}>
              <ThemedText style={{ fontSize: 28, fontWeight: '700', textAlign: 'center' }}>
                Pick your starter habit
              </ThemedText>
              <ThemedText
                type="small"
                style={{ color: palette.textSecondary, textAlign: 'center' }}>
                You can add more later.
              </ThemedText>
              <View style={{ gap: Spacing.two, alignSelf: 'stretch' }}>
                {STARTER_HABITS.map((h, i) => {
                  const selected = i === picked;
                  return (
                    <Pressable
                      key={h.name}
                      onPress={() => {
                        setPicked(i);
                        setReminderTime(h.reminderTime);
                        feedback.fire('tick');
                      }}
                      style={[
                        styles.pickCard,
                        {
                          backgroundColor: selected
                            ? palette.backgroundSelected
                            : palette.backgroundElement,
                          borderColor: selected ? palette.text : palette.backgroundSelected,
                        },
                      ]}>
                      <ThemedText style={{ fontSize: 32 }}>{h.emoji}</ThemedText>
                      <View style={{ flexShrink: 1 }}>
                        <ThemedText style={{ fontSize: 16, fontWeight: '700' }}>{h.name}</ThemedText>
                        <ThemedText type="small" style={{ color: palette.textSecondary }}>
                          {h.type === 'binary' ? 'Once a day' : `${h.target}× a day`}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <PrimaryButton onPress={() => setStep('reminder')} palette={palette}>
                Next
              </PrimaryButton>
            </View>
          )}

          {step === 'reminder' && (
            <View style={styles.slide}>
              <ThemedText style={styles.hugeEmoji}>🔔</ThemedText>
              <ThemedText style={{ fontSize: 26, fontWeight: '700', textAlign: 'center' }}>
                Never miss a day
              </ThemedText>
              <ThemedText
                style={{ color: palette.textSecondary, textAlign: 'center', fontSize: 15, lineHeight: 21 }}>
                A quick daily nudge at the time you pick. You can turn it off any time.
              </ThemedText>
              <PrimaryButton onPress={askForNotifications} palette={palette}>
                Enable reminders
              </PrimaryButton>
              <Pressable onPress={() => { setReminderTime(null); setStep('ready'); }}>
                <ThemedText
                  type="small"
                  style={{ color: palette.textSecondary, textAlign: 'center' }}>
                  No thanks
                </ThemedText>
              </Pressable>
            </View>
          )}

          {step === 'ready' && (
            <View style={styles.slide}>
              <ThemedText style={styles.hugeEmoji}>🎯</ThemedText>
              <ThemedText style={{ fontSize: 26, fontWeight: '700', textAlign: 'center' }}>
                Your 3-day challenge
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.challengeBox}>
                <ThemedText style={{ fontSize: 32 }}>{STARTER_HABITS[picked].emoji}</ThemedText>
                <ThemedText style={{ fontSize: 18, fontWeight: '700' }}>
                  {STARTER_HABITS[picked].name}
                </ThemedText>
                <ThemedText type="small" style={{ color: palette.textSecondary, textAlign: 'center' }}>
                  Complete it 3 days in a row to earn 🏆
                </ThemedText>
                {reminderTime && (
                  <ThemedText type="small" style={{ color: palette.textSecondary }}>
                    Reminder set for {reminderTime}
                  </ThemedText>
                )}
              </ThemedView>
              <PrimaryButton onPress={finish} palette={palette}>
                Let's go
              </PrimaryButton>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function PrimaryButton({
  onPress,
  palette,
  children,
}: {
  onPress: () => void;
  palette: Palette;
  children: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: palette.text, opacity: pressed ? 0.85 : 1 },
      ]}>
      <ThemedText style={{ color: palette.background, fontWeight: '700', fontSize: 16 }}>
        {children}
      </ThemedText>
    </Pressable>
  );
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
    paddingVertical: Spacing.five,
  },
  slide: {
    gap: Spacing.four,
    alignItems: 'center',
  },
  hugeEmoji: {
    fontSize: 96,
    lineHeight: 110,
  },
  pickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
  },
  challengeBox: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'stretch',
  },
  primary: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.two,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
});
