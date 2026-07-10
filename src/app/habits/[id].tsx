import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ConsistencyChart } from '@/components/consistency-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Palette, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { currentStreak, dayCount, isDoneForDay, todayKey } from '@/lib/habits';
import { format12h } from '@/lib/time';
import { useHabits } from '@/lib/use-habits';

export default function HabitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { getHabit, removeHabit } = useHabits();
  const habit = getHabit(id);

  const logEntries = useMemo(() => {
    if (!habit) return [];
    return Object.entries(habit.completions)
      .filter(([, v]) => v > 0)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 30);
  }, [habit]);

  if (!habit) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Habit not found.</ThemedText>
      </ThemedView>
    );
  }

  function handleDelete() {
    if (!habit) return;
    Alert.alert('Delete habit?', `Remove "${habit.name}" and its history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeHabit(habit.id);
          router.back();
        },
      },
    ]);
  }

  const streak = currentStreak(habit);
  const todayC = dayCount(habit);
  const totalDays = Object.values(habit.completions).filter((v) => v > 0).length;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroRow}>
          <ThemedText style={styles.emoji}>{habit.emoji}</ThemedText>
          <View style={{ flexShrink: 1 }}>
            <ThemedText style={{ fontSize: 24, fontWeight: '700' }}>{habit.name}</ThemedText>
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              {habit.type === 'binary'
                ? 'Once a day'
                : `${habit.target}× a day · today ${todayC}/${habit.target}`}
              {habit.reminderTime ? ` · ⏰ ${format12h(habit.reminderTime)}` : ''}
            </ThemedText>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat label="Streak" value={`${streak}`} palette={palette} />
          <Stat label="Total days" value={`${totalDays}`} palette={palette} />
          <Stat
            label="Today"
            value={isDoneForDay(habit) ? '✓' : `${todayC}/${habit.target}`}
            palette={palette}
          />
        </View>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ConsistencyChart habit={habit} />
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText style={{ fontSize: 16, fontWeight: '600' }}>Log</ThemedText>
          {logEntries.length === 0 && (
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              No entries yet.
            </ThemedText>
          )}
          {logEntries.map(([date, count]) => (
            <View key={date} style={styles.logRow}>
              <ThemedText style={{ fontSize: 15 }}>{formatLogDate(date)}</ThemedText>
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                {habit.type === 'binary' ? '✓' : `${count}/${habit.target}`}
              </ThemedText>
            </View>
          ))}
        </ThemedView>

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push({ pathname: '/habits/new', params: { editId: habit.id } })}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: palette.backgroundElement,
                borderColor: palette.backgroundSelected,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <ThemedText style={{ fontWeight: '600' }}>Edit</ThemedText>
          </Pressable>
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: palette.backgroundElement,
                borderColor: '#d64545',
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <ThemedText style={{ color: '#d64545', fontWeight: '600' }}>Delete</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Stat({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: Palette;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.stat}>
      <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>{value}</ThemedText>
      <ThemedText type="small" style={{ color: palette.textSecondary }}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

function formatLogDate(date: string): string {
  if (date === todayKey()) return 'Today';
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: Spacing.three,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  emoji: { fontSize: 44, lineHeight: 50 },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'flex-start',
    gap: 2,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
  },
});
