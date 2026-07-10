import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChallengeBanner } from '@/components/challenge-banner';
import { HabitRow } from '@/components/habit-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { dayCount, isDoneForDay } from '@/lib/habits';
import { useFeedback } from '@/lib/feedback';
import { useHabits } from '@/lib/use-habits';

export default function TodayScreen() {
  const { habits, ready, activeChallenge, toggleBinaryHabit, bumpHabit } = useHabits();
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const feedback = useFeedback();
  const router = useRouter();

  const doneCount = habits.filter((h) => isDoneForDay(h)).length;
  const total = habits.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  function handleToggleBinary(id: string) {
    const before = habits.find((h) => h.id === id);
    const willBeDone = before ? !isDoneForDay(before) : false;
    toggleBinaryHabit(id);
    feedback.fire(willBeDone ? 'complete' : 'tick');
  }

  function handleBump(id: string, delta: number) {
    const before = habits.find((h) => h.id === id);
    if (!before) return;
    const wasDone = isDoneForDay(before);
    const nextCount = Math.max(0, dayCount(before) + delta);
    const willBeDone = nextCount >= before.target;
    bumpHabit(id, delta);
    if (delta > 0 && !wasDone && willBeDone) feedback.fire('complete');
    else feedback.fire('tick');
  }

  function openDetail(id: string) {
    router.push(`/habits/${id}` as never);
  }

  function openNew() {
    router.push('/habits/new' as never);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="title">Today</ThemedText>
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            {formatDate(new Date())}
          </ThemedText>
        </View>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}>
          {activeChallenge && (
            <ChallengeBanner
              challenge={activeChallenge}
              onPress={() => router.push('/challenges' as never)}
            />
          )}

          <ThemedView type="backgroundElement" style={styles.summary}>
            <ThemedText style={{ fontSize: 16, fontWeight: '600' }}>
              {doneCount}/{total} done today
            </ThemedText>
            <View style={[styles.progressTrack, { backgroundColor: palette.backgroundSelected }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${pct}%`, backgroundColor: palette.text },
                ]}
              />
            </View>
          </ThemedView>

          {!ready && (
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              Loading…
            </ThemedText>
          )}
          {ready && habits.length === 0 && (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText style={{ fontSize: 16, fontWeight: '600' }}>No habits yet</ThemedText>
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                Tap the button below to add one.
              </ThemedText>
            </ThemedView>
          )}
          {habits.map((h) => (
            <HabitRow
              key={h.id}
              habit={h}
              onPress={() =>
                h.type === 'binary' ? handleToggleBinary(h.id) : openDetail(h.id)
              }
              onDecrement={h.type === 'count' ? () => handleBump(h.id, -1) : undefined}
              onIncrement={h.type === 'count' ? () => handleBump(h.id, 1) : undefined}
              onOpenDetail={() => openDetail(h.id)}
            />
          ))}

          <Pressable
            onPress={openNew}
            style={({ pressed }) => [
              styles.addBtn,
              {
                backgroundColor: palette.text,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <ThemedText
              style={{ color: palette.background, fontWeight: '700', fontSize: 16 }}>
              + New habit
            </ThemedText>
          </Pressable>

          {ready && habits.length > 0 && (
            <ThemedText
              type="small"
              style={{ color: palette.textSecondary, textAlign: 'center', marginTop: Spacing.two }}>
              Tap the ▸ on any habit to see history, chart & edit
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingTop: Spacing.three,
    gap: 2,
  },
  summary: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  emptyCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  addBtn: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
