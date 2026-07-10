import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Colors, Palette, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Habit, addDays, isDoneForDay, todayKey } from '@/lib/habits';

const COLS = 15;
const ROWS = 6;
const CELL = 16;
const GAP = 3;

export function BigHeatmap({ habits }: { habits: Habit[] }) {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const total = COLS * ROWS;

  const today = todayKey();
  const cells: { date: string; ratio: number }[] = [];
  for (let i = total - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    if (habits.length === 0) {
      cells.push({ date, ratio: 0 });
      continue;
    }
    const doneCount = habits.filter((h) => isDoneForDay(h, date)).length;
    cells.push({ date, ratio: doneCount / habits.length });
  }

  const width = COLS * CELL + (COLS - 1) * GAP;
  const height = ROWS * CELL + (ROWS - 1) * GAP;

  const doneDays = cells.filter((c) => c.ratio > 0).length;
  const perfectDays = cells.filter((c) => c.ratio >= 1).length;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <ThemedText style={{ fontSize: 16, fontWeight: '700' }}>Last {total} days</ThemedText>
        <ThemedText type="small" style={{ color: palette.textSecondary }}>
          {perfectDays} perfect · {doneDays} active
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
              rx={4}
              ry={4}
              fill={fill}
            />
          );
        })}
      </Svg>
      <Legend palette={palette} />
    </View>
  );
}

function Legend({ palette }: { palette: Palette }) {
  return (
    <View style={styles.legend}>
      <ThemedText type="small" style={{ color: palette.textSecondary }}>
        Less
      </ThemedText>
      {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
        <View
          key={i}
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            backgroundColor:
              r === 0 ? palette.backgroundSelected : blend(palette.backgroundSelected, palette.text, r),
          }}
        />
      ))}
      <ThemedText type="small" style={{ color: palette.textSecondary }}>
        More
      </ThemedText>
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
  wrap: { gap: Spacing.two, alignItems: 'flex-start' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    alignItems: 'baseline',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
});
