import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigHeatmap } from '@/components/big-heatmap';
import { RewardBadge } from '@/components/reward-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WeeklyBars } from '@/components/weekly-bars';
import { BottomTabInset, Colors, MaxContentWidth, Palette, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Habit, bestStreak, currentStreak, dayCountsForRange, totalDoneDays } from '@/lib/habits';
import { useHabits } from '@/lib/use-habits';

export default function HistoryScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { habits, challenges } = useHabits();

  const stats = useMemo(() => {
    const totalCompletions = habits.reduce((s, h) => s + totalDoneDays(h), 0);
    const longest = habits.reduce((m, h) => Math.max(m, bestStreak(h)), 0);
    const rewards = challenges.filter((c) => c.completedAt).length;
    return { totalCompletions, longest, rewards };
  }, [habits, challenges]);

  const rankedHabits = useMemo(
    () => [...habits].sort((a, b) => totalDoneDays(b) - totalDoneDays(a)),
    [habits],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          <View style={{ paddingTop: Spacing.three, gap: 2 }}>
            <ThemedText type="title">History</ThemedText>
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              Every step counts.
            </ThemedText>
          </View>

          <View style={styles.statRow}>
            <StatTile value={stats.totalCompletions} label="Completions" palette={palette} />
            <StatTile value={stats.longest} label="Best streak" palette={palette} />
            <StatTile value={stats.rewards} label="Rewards" palette={palette} />
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <BigHeatmap habits={habits} />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <WeeklyBars habits={habits} />
          </ThemedView>

          <View style={{ gap: Spacing.two }}>
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              PER HABIT
            </ThemedText>
            {rankedHabits.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="small" style={{ color: palette.textSecondary }}>
                  Nothing to show yet — add a habit and start tracking.
                </ThemedText>
              </ThemedView>
            )}
            {rankedHabits.map((h) => (
              <PerHabitRow
                key={h.id}
                habit={h}
                onPress={() => router.push(`/habits/${h.id}` as never)}
                palette={palette}
              />
            ))}
          </View>

          {stats.rewards > 0 && (
            <View style={{ gap: Spacing.two }}>
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                RECENT REWARDS
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: Spacing.three, paddingVertical: Spacing.two }}>
                {challenges
                  .filter((c) => c.completedAt)
                  .slice(-6)
                  .reverse()
                  .map((c) => {
                    const h = habits.find((x) => x.id === c.habitId);
                    return (
                      <View key={c.id} style={{ alignItems: 'center', width: 100 }}>
                        <RewardBadge emoji={h?.emoji ?? c.rewardEmoji} days={c.days} size={80} />
                        <ThemedText
                          type="small"
                          numberOfLines={1}
                          style={{ fontWeight: '600', marginTop: 6 }}>
                          {h?.name ?? 'Habit'}
                        </ThemedText>
                      </View>
                    );
                  })}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function StatTile({
  value,
  label,
  palette,
}: {
  value: number | string;
  label: string;
  palette: Palette;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.stat}>
      <ThemedText style={{ fontSize: 26, fontWeight: '800' }}>{value}</ThemedText>
      <ThemedText type="small" style={{ color: palette.textSecondary }}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

function PerHabitRow({
  habit,
  onPress,
  palette,
}: {
  habit: Habit;
  onPress: () => void;
  palette: Palette;
}) {
  const counts = dayCountsForRange(habit, 30);
  const total = totalDoneDays(habit);
  const streak = currentStreak(habit);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.perHabit,
        { backgroundColor: palette.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={styles.perHabitTop}>
        <ThemedText style={{ fontSize: 28 }}>{habit.emoji}</ThemedText>
        <View style={{ flexShrink: 1, flexGrow: 1 }}>
          <ThemedText style={{ fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
            {habit.name}
          </ThemedText>
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            🔥 {streak} · {total} total
          </ThemedText>
        </View>
        <ThemedText style={{ fontSize: 16, fontWeight: '700', color: palette.textSecondary }}>
          ▸
        </ThemedText>
      </View>
      <View style={styles.strip}>
        {counts.map((c, i) => {
          const isDone = habit.type === 'binary' ? c > 0 : c >= habit.target;
          const ratio = habit.type === 'binary' ? (c > 0 ? 1 : 0) : Math.min(1, c / habit.target);
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 22,
                borderRadius: 3,
                backgroundColor: isDone
                  ? palette.text
                  : ratio > 0
                    ? palette.textSecondary
                    : palette.backgroundSelected,
                opacity: isDone ? 1 : ratio > 0 ? 0.6 : 0.4,
              }}
            />
          );
        })}
      </View>
    </Pressable>
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
  statRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: 2,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  emptyCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  perHabit: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  perHabitTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  strip: {
    flexDirection: 'row',
    gap: 2,
  },
});
