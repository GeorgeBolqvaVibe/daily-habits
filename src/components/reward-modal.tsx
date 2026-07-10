import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { RewardBadge } from '@/components/reward-badge';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  visible: boolean;
  onClaim: () => void;
  emoji: string;
  days: number;
  title: string;
  subtitle: string;
};

export function RewardModal({ visible, onClaim, emoji, days, title, subtitle }: Props) {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const scale = useRef(new Animated.Value(0.4)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      scale.setValue(0.4);
      rotate.setValue(0);
      glow.setValue(0);
      return;
    }
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotate, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: -1, duration: 800, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    ).start();
  }, [visible, scale, rotate, glow]);

  const rotateInterp = rotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-8deg', '8deg'],
  });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.55] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClaim}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: palette.background }]}>
          <ThemedText
            type="small"
            style={{ color: palette.textSecondary, fontWeight: '700', letterSpacing: 2 }}>
            REWARD UNLOCKED
          </ThemedText>
          <View style={styles.badgeStage}>
            <Animated.View
              style={[
                styles.glow,
                { opacity: glowOpacity, transform: [{ scale: glowScale }] },
              ]}
            />
            <Animated.View
              style={{ transform: [{ scale }, { rotate: rotateInterp }] }}>
              <RewardBadge emoji={emoji} days={days} size={180} showLabel />
            </Animated.View>
          </View>
          <ThemedText style={{ fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
            {title}
          </ThemedText>
          <ThemedText
            type="small"
            style={{ color: palette.textSecondary, textAlign: 'center', paddingHorizontal: 8 }}>
            {subtitle}
          </ThemedText>
          <Pressable
            onPress={onClaim}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: palette.text, opacity: pressed ? 0.85 : 1 },
            ]}>
            <ThemedText style={{ color: palette.background, fontWeight: '700', fontSize: 16 }}>
              Claim reward
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.two,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  badgeStage: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.two,
  },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#F5D66C',
  },
  button: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.two,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
});
