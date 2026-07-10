import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

type Tier = 'bronze' | 'silver' | 'gold';

const TIERS: Record<Tier, { light: string; dark: string; ring: string; label: string }> = {
  bronze: { light: '#E4A574', dark: '#8B4A26', ring: 'rgba(255,240,220,0.6)', label: 'BRONZE' },
  silver: { light: '#EAEEF2', dark: '#7A828C', ring: 'rgba(255,255,255,0.6)', label: 'SILVER' },
  gold: { light: '#F5D66C', dark: '#B8862A', ring: 'rgba(255,240,200,0.7)', label: 'GOLD' },
};

export function tierForDays(days: number): Tier {
  if (days >= 14) return 'gold';
  if (days >= 7) return 'silver';
  return 'bronze';
}

export function RewardBadge({
  emoji,
  days,
  size = 120,
  showLabel = false,
}: {
  emoji: string;
  days: number;
  size?: number;
  showLabel?: boolean;
}) {
  const tier = tierForDays(days);
  const t = TIERS[tier];

  const dots = Array.from({ length: Math.max(days, 1) });

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg
          style={StyleSheet.absoluteFill}
          width={size}
          height={size}
          viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`bg-${tier}`} cx="30%" cy="30%" r="70%">
              <Stop offset="0%" stopColor={t.light} stopOpacity="1" />
              <Stop offset="100%" stopColor={t.dark} stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="48" fill={`url(#bg-${tier})`} />
          <Circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={t.ring}
            strokeWidth={1.5}
            strokeDasharray="1.5 3"
          />
          <Circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={0.8}
          />
          {dots.map((_, i) => {
            const angle = (i / dots.length) * 2 * Math.PI - Math.PI / 2;
            const x = 50 + Math.cos(angle) * 46;
            const y = 50 + Math.sin(angle) * 46;
            return (
              <Circle key={i} cx={x} cy={y} r={1.6} fill="rgba(255,255,255,0.9)" />
            );
          })}
          <Circle cx="30" cy="26" r="12" fill="rgba(255,255,255,0.14)" />
        </Svg>
        <Text style={{ fontSize: size * 0.42 }}>{emoji}</Text>
        <View style={[styles.dayChip, { top: size - size * 0.28 }]}>
          <Text style={{ color: t.dark, fontWeight: '800', fontSize: size * 0.11, letterSpacing: 0.5 }}>
            {days}D
          </Text>
        </View>
      </View>
      {showLabel && (
        <Text style={{ color: t.dark, fontWeight: '800', fontSize: 11, letterSpacing: 1.5 }}>
          {t.label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dayChip: {
    position: 'absolute',
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});
