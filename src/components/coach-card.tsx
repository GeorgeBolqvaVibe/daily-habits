import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';
import { Insight, InsightKind, generateInsight, latestInsight } from '@/lib/coach';

type Props = {
  kind: InsightKind;
  period?: 'weekly' | 'monthly';
  title: string;
  cta: string;
  /** Number of habits — the coach needs data to say anything useful. */
  habitCount: number;
};

export function CoachCard({ kind, period, title, cta, habitCount }: Props) {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const { enabled, userId } = useAuth();

  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (userId) {
      latestInsight(kind).then((i) => {
        if (!cancelled) setInsight(i);
      });
    } else {
      setInsight(null);
    }
    return () => {
      cancelled = true;
    };
  }, [userId, kind]);

  // Only relevant when signed into cloud sync.
  if (!enabled || !userId) return null;

  async function refresh() {
    setLoading(true);
    setError(null);
    const { insight: fresh, error } = await generateInsight(kind, period);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    setInsight(fresh);
  }

  const disabled = loading || habitCount === 0;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText style={{ fontSize: 15, fontWeight: '700' }}>✨ {title}</ThemedText>
        <Pressable
          onPress={refresh}
          disabled={disabled}
          hitSlop={8}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: palette.text,
              opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
            },
          ]}>
          {loading ? (
            <ActivityIndicator size="small" color={palette.background} />
          ) : (
            <ThemedText style={{ color: palette.background, fontWeight: '600', fontSize: 13 }}>
              {insight ? 'Refresh' : cta}
            </ThemedText>
          )}
        </Pressable>
      </View>

      {error && (
        <ThemedText type="small" style={{ color: '#d64545' }}>
          {error}
        </ThemedText>
      )}

      {!insight && !error && (
        <ThemedText type="small" style={{ color: palette.textSecondary }}>
          {habitCount === 0
            ? 'Add a habit to get personalized coaching.'
            : `Tap ${cta.toLowerCase()} for an AI-generated insight based on your streaks.`}
        </ThemedText>
      )}

      {insight && (
        <>
          <ThemedText style={{ fontSize: 15, lineHeight: 22 }}>{insight.content}</ThemedText>
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            {formatWhen(insight.created_at)}
          </ThemedText>
        </>
      )}
    </ThemedView>
  );
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return `Generated ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  btn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Spacing.two,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
