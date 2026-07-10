import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RewardBadge } from '@/components/reward-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Palette, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Challenge, addDays, daysBetween, todayKey } from '@/lib/habits';
import { useChallengeProgress, useHabits } from '@/lib/use-habits';

const DURATIONS = [3, 7, 21];
const REWARDS = ['🏆', '🥇', '🌟', '💎', '🔥', '🚀'];

export default function ChallengesScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { habits, challenges, activeChallenge, startChallenge, getHabit } = useHabits();

  const completed = useMemo(
    () =>
      challenges
        .filter((c) => c.completedAt)
        .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1)),
    [challenges],
  );

  const [selectedHabit, setSelectedHabit] = useState<string | null>(habits[0]?.id ?? null);
  const [selectedDays, setSelectedDays] = useState<number>(3);

  function handleStart() {
    if (!selectedHabit) return;
    const habit = getHabit(selectedHabit);
    if (!habit) return;
    const reward = REWARDS[challenges.length % REWARDS.length];
    startChallenge({
      habitId: habit.id,
      title: `${selectedDays}-day ${habit.name} challenge`,
      days: selectedDays,
      rewardEmoji: reward,
    });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          <View style={{ paddingTop: Spacing.three, gap: Spacing.half }}>
            <ThemedText type="title">Challenges</ThemedText>
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              Commit to a streak and earn a reward.
            </ThemedText>
          </View>

          {activeChallenge && <ActiveCard challenge={activeChallenge} palette={palette} />}

          {!activeChallenge && (
            <ThemedView type="backgroundElement" style={styles.startCard}>
              <ThemedText style={{ fontSize: 16, fontWeight: '700' }}>Start a challenge</ThemedText>
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                Pick a habit and a length.
              </ThemedText>

              <ThemedText
                type="small"
                style={{ color: palette.textSecondary, marginTop: Spacing.two }}>
                HABIT
              </ThemedText>
              <View style={styles.chipRow}>
                {habits.length === 0 && (
                  <Pressable
                    onPress={() => router.push('/habits/new')}
                    style={[
                      styles.linkChip,
                      { borderColor: palette.text, backgroundColor: palette.background },
                    ]}>
                    <ThemedText style={{ fontWeight: '600' }}>+ Add a habit first</ThemedText>
                  </Pressable>
                )}
                {habits.map((h) => {
                  const selected = h.id === selectedHabit;
                  return (
                    <Pressable
                      key={h.id}
                      onPress={() => setSelectedHabit(h.id)}
                      style={[
                        styles.habitChip,
                        {
                          backgroundColor: selected
                            ? palette.backgroundSelected
                            : palette.background,
                          borderColor: selected ? palette.text : palette.backgroundSelected,
                        },
                      ]}>
                      <ThemedText style={{ fontSize: 18 }}>{h.emoji}</ThemedText>
                      <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>{h.name}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <ThemedText
                type="small"
                style={{ color: palette.textSecondary, marginTop: Spacing.two }}>
                LENGTH
              </ThemedText>
              <View style={styles.chipRow}>
                {DURATIONS.map((d) => {
                  const selected = d === selectedDays;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setSelectedDays(d)}
                      style={[
                        styles.durationChip,
                        {
                          backgroundColor: selected
                            ? palette.backgroundSelected
                            : palette.background,
                          borderColor: selected ? palette.text : palette.backgroundSelected,
                        },
                      ]}>
                      <ThemedText style={{ fontSize: 16, fontWeight: '700' }}>{d}</ThemedText>
                      <ThemedText type="small" style={{ color: palette.textSecondary }}>
                        days
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                disabled={!selectedHabit}
                onPress={handleStart}
                style={({ pressed }) => [
                  styles.startBtn,
                  {
                    backgroundColor: palette.text,
                    opacity: !selectedHabit ? 0.4 : pressed ? 0.85 : 1,
                  },
                ]}>
                <ThemedText style={{ color: palette.background, fontWeight: '700', fontSize: 16 }}>
                  Start challenge
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              PAST REWARDS ({completed.length})
            </ThemedText>
            {completed.length === 0 && (
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                No rewards yet.
              </ThemedText>
            )}
            <View style={styles.rewardGrid}>
              {completed.map((c) => {
                const h = getHabit(c.habitId);
                return (
                  <ThemedView key={c.id} type="backgroundElement" style={styles.rewardCard}>
                    <RewardBadge emoji={h?.emoji ?? c.rewardEmoji} days={c.days} size={92} />
                    <ThemedText type="small" style={{ fontWeight: '600', textAlign: 'center' }}>
                      {c.title}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: palette.textSecondary }}>
                      {c.completedAt}
                    </ThemedText>
                  </ThemedView>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ActiveCard({
  challenge,
  palette,
}: {
  challenge: Challenge;
  palette: Palette;
}) {
  const p = useChallengeProgress(challenge);
  if (!p) return null;
  const endsOn = addDays(challenge.startDate, challenge.days - 1);
  const daysLeft = Math.max(0, daysBetween(todayKey(), endsOn));
  return (
    <ThemedView type="backgroundElement" style={styles.activeCard}>
      <View style={styles.activeHeader}>
        <ThemedText style={{ fontSize: 16, fontWeight: '700' }}>Active</ThemedText>
        <ThemedText type="small" style={{ color: palette.textSecondary }}>
          {daysLeft === 0 ? 'ends today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
        </ThemedText>
      </View>
      <ThemedText style={{ fontSize: 20, fontWeight: '700', marginTop: 2 }}>
        {challenge.title}
      </ThemedText>
      <View style={styles.dotRow}>
        {Array.from({ length: challenge.days }).map((_, i) => {
          const filled = i < p.done;
          return (
            <View
              key={i}
              style={[
                styles.dayDot,
                { backgroundColor: filled ? palette.text : palette.backgroundSelected },
              ]}
            />
          );
        })}
      </View>
      <ThemedText type="small" style={{ color: palette.textSecondary }}>
        {p.done}/{p.needed} days done · reward on completion
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  scroll: {
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  startCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  habitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  linkChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  durationChip: {
    minWidth: 70,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  startBtn: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  activeCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  dayDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  rewardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  rewardCard: {
    width: '48%',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: 4,
    alignItems: 'center',
  },
});
