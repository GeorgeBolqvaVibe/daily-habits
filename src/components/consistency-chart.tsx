import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Habit, addDays, dayCount, todayKey } from '@/lib/habits';

const COLS = 7;
const ROWS = 5;
const CELL = 22;
const GAP = 4;

export function ConsistencyChart({ habit }: { habit: Habit }) {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const total = COLS * ROWS;

  const today = todayKey();
  const cells: { date: string; ratio: number; done: boolean; future: boolean }[] = [];
  for (let i = total - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const c = dayCount(habit, date);
    const ratio =
      habit.type === 'binary' ? (c > 0 ? 1 : 0) : Math.min(1, c / Math.max(1, habit.target));
    cells.push({ date, ratio, done: ratio >= 1, future: false });
  }

  const width = COLS * CELL + (COLS - 1) * GAP;
  const height = ROWS * CELL + (ROWS - 1) * GAP;

  const doneDays = cells.filter((c) => c.done).length;
  const consistency = Math.round((doneDays / total) * 100);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <ThemedText style={{ fontSize: 16, fontWeight: '600' }}>Last {total} days</ThemedText>
        <ThemedText type="small" style={{ color: palette.textSecondary }}>
          {consistency}% consistent
        </ThemedText>
      </View>
      <Svg width={width} height={height}>
        {cells.map((c, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const x = col * (CELL + GAP);
          const y = row * (CELL + GAP);
          const fill =
            c.ratio === 0
              ? palette.backgroundSelected
              : blend(palette.backgroundSelected, palette.text, c.ratio);
          return (
            <Rect
              key={c.date}
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              rx={5}
              ry={5}
              fill={fill}
            />
          );
        })}
      </Svg>
    </View>
  );
}

function blend(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    alignItems: 'baseline',
  },
});
