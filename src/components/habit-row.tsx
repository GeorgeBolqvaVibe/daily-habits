import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Palette, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Habit,
  currentStreak,
  dayCount,
  dayCountsForRange,
  isDoneForDay,
  progress,
} from '@/lib/habits';

type Props = {
  habit: Habit;
  onPress: () => void;
  onDecrement?: () => void;
  onIncrement?: () => void;
  onOpenDetail?: () => void;
};

export function HabitRow({ habit, onPress, onDecrement, onIncrement, onOpenDetail }: Props) {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const done = isDoneForDay(habit);
  const streak = currentStreak(habit);
  const ratio = progress(habit);
  const count = dayCount(habit);

  const scale = useRef(new Animated.Value(1)).current;
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.25, duration: 140, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
      ]).start();
    }
    wasDone.current = done;
  }, [done, scale]);

  const isCount = habit.type === 'count';

  return (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.row,
        done && { backgroundColor: palette.backgroundSelected },
      ]}>
      <Pressable onPress={onPress} style={styles.pressArea} hitSlop={6}>
        <View style={styles.left}>
          <ThemedText style={styles.emoji}>{habit.emoji}</ThemedText>
          <View style={{ flexShrink: 1 }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
              {habit.name}
            </ThemedText>
            <ThemedText type="small" style={{ color: palette.textSecondary }}>
              {streak > 0 ? `🔥 ${streak}-day streak` : 'Start a streak today'}
              {isCount ? ` · ${count}/${habit.target} today` : ''}
            </ThemedText>
            <MiniStrip habit={habit} palette={palette} />
          </View>
        </View>
      </Pressable>

      {onOpenDetail && (
        <Pressable
          onPress={onOpenDetail}
          hitSlop={10}
          style={({ pressed }) => [
            styles.chevron,
            {
              backgroundColor: palette.background,
              borderColor: palette.backgroundSelected,
              opacity: pressed ? 0.6 : 1,
            },
          ]}>
          <ThemedText style={{ fontSize: 16, fontWeight: '700' }}>▸</ThemedText>
        </Pressable>
      )}

      {isCount ? (
        <View style={styles.counter}>
          <Pressable
            onPress={onDecrement}
            disabled={count === 0}
            hitSlop={10}
            style={({ pressed }) => [
              styles.counterBtn,
              {
                borderColor: palette.backgroundSelected,
                opacity: count === 0 ? 0.3 : pressed ? 0.5 : 1,
              },
            ]}>
            <ThemedText style={styles.counterSign}>−</ThemedText>
          </Pressable>
          <Animated.View
            style={[
              styles.countBubble,
              {
                backgroundColor: done ? palette.text : palette.background,
                borderColor: palette.text,
                transform: [{ scale }],
              },
            ]}>
            <ThemedText
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: done ? palette.background : palette.text,
              }}>
              {count}
            </ThemedText>
          </Animated.View>
          <Pressable
            onPress={onIncrement}
            hitSlop={10}
            style={({ pressed }) => [
              styles.counterBtn,
              {
                borderColor: palette.text,
                backgroundColor: done ? palette.text : 'transparent',
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <ThemedText
              style={[
                styles.counterSign,
                { color: done ? palette.background : palette.text },
              ]}>
              +
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onPress} hitSlop={12}>
          <Animated.View
            style={[
              styles.check,
              {
                borderColor: palette.text,
                backgroundColor: done ? palette.text : 'transparent',
                transform: [{ scale }],
              },
            ]}>
            {done && (
              <ThemedText style={[styles.checkMark, { color: palette.background }]}>
                ✓
              </ThemedText>
            )}
          </Animated.View>
        </Pressable>
      )}
      <ProgressBar ratio={ratio} palette={palette} />
    </ThemedView>
  );
}

function MiniStrip({ habit, palette }: { habit: Habit; palette: Palette }) {
  const counts = dayCountsForRange(habit, 7);
  return (
    <View style={styles.strip}>
      {counts.map((c, i) => {
        const isDone = habit.type === 'binary' ? c > 0 : c >= habit.target;
        return (
          <View
            key={i}
            style={[
              styles.stripDot,
              {
                backgroundColor: isDone
                  ? palette.text
                  : palette.backgroundSelected,
                opacity: isDone ? 1 : 0.6,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function ProgressBar({
  ratio,
  palette,
}: {
  ratio: number;
  palette: Palette;
}) {
  return (
    <View style={[styles.progressTrack, { backgroundColor: palette.backgroundSelected }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.round(ratio * 100)}%`, backgroundColor: palette.text },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    overflow: 'hidden',
  },
  pressArea: {
    flex: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flexShrink: 1,
  },
  emoji: { fontSize: 28, lineHeight: 34 },
  strip: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  stripDot: {
    width: 12,
    height: 6,
    borderRadius: 3,
  },
  check: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 20, fontWeight: '700', lineHeight: 22 },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  counterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterSign: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
  },
  countBubble: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  progressFill: {
    height: '100%',
  },
  chevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
