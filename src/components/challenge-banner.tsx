import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Challenge, addDays, daysBetween, todayKey } from '@/lib/habits';
import { useChallengeProgress } from '@/lib/use-habits';

type Props = {
  challenge: Challenge;
  onPress?: () => void;
};

export function ChallengeBanner({ challenge, onPress }: Props) {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const p = useChallengeProgress(challenge);
  if (!p) return null;
  const dayNumber = Math.min(
    challenge.days,
    Math.max(1, daysBetween(challenge.startDate, todayKey()) + 1),
  );
  const endsOn = addDays(challenge.startDate, challenge.days - 1);
  const daysLeft = Math.max(0, daysBetween(todayKey(), endsOn));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.banner,
        {
          backgroundColor: palette.text,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <View style={styles.top}>
        <ThemedText
          type="small"
          style={{ color: palette.background, opacity: 0.7, fontWeight: '600' }}>
          🎯 ACTIVE CHALLENGE
        </ThemedText>
        <ThemedText type="small" style={{ color: palette.background, opacity: 0.7 }}>
          Day {dayNumber}/{challenge.days}
        </ThemedText>
      </View>
      <ThemedText
        style={{
          color: palette.background,
          fontSize: 18,
          fontWeight: '700',
          marginTop: 2,
        }}>
        {challenge.title}
      </ThemedText>
      <View style={[styles.track, { backgroundColor: palette.background + '33' }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(p.ratio * 100)}%`,
              backgroundColor: palette.background,
            },
          ]}
        />
      </View>
      <ThemedText
        type="small"
        style={{ color: palette.background, opacity: 0.85, marginTop: 6 }}>
        {p.done}/{p.needed} done ·{' '}
        {daysLeft === 0 ? 'ends today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`} · tap to view
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: 2,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: Spacing.two,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
