import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Habit, addDays, isDoneForDay, todayKey } from '@/lib/habits';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BAR_MAX_HEIGHT = 100;

export function WeeklyBars({ habits }: { habits: Habit[] }) {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const today = todayKey();
  const days: { date: string; label: string; done: number; total: number; ratio: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    const [y, m, d] = date.split('-').map(Number);
    const label = DAY_LABELS[new Date(y, m - 1, d).getDay()];
    const done = habits.filter((h) => isDoneForDay(h, date)).length;
    const total = habits.length;
    days.push({ date, label, done, total, ratio: total === 0 ? 0 : done / total });
  }

  const bestRatio = Math.max(...days.map((d) => d.ratio));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <ThemedText style={{ fontSize: 16, fontWeight: '700' }}>This week</ThemedText>
        <ThemedText type="small" style={{ color: palette.textSecondary }}>
          {days.reduce((s, d) => s + d.done, 0)} completions
        </ThemedText>
      </View>
      <View style={styles.chart}>
        {days.map((d) => {
          const isToday = d.date === today;
          const isBest = bestRatio > 0 && d.ratio === bestRatio;
          return (
            <View key={d.date} style={styles.col}>
              <View style={[styles.track, { backgroundColor: palette.backgroundSelected }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      height: `${Math.max(4, Math.round(d.ratio * 100))}%`,
                      backgroundColor: isBest ? palette.text : palette.textSecondary,
                    },
                  ]}
                />
              </View>
              <ThemedText
                type="small"
                style={{
                  color: isToday ? palette.text : palette.textSecondary,
                  fontWeight: isToday ? '700' : '500',
                  marginTop: 6,
                }}>
                {d.label}
              </ThemedText>
              <ThemedText
                type="small"
                style={{ color: palette.textSecondary, fontSize: 11 }}>
                {d.done}/{d.total}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  track: {
    width: 22,
    height: BAR_MAX_HEIGHT,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    borderRadius: 6,
  },
});
