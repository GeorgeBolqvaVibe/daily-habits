import { supabase } from './supabase';

export type InsightKind = 'nudge' | 'reflection';

export type Insight = {
  id: string;
  kind: InsightKind;
  period: 'weekly' | 'monthly' | null;
  content: string;
  stats: Record<string, unknown>;
  created_at: string;
};

/** Ask the Edge Function to generate a fresh insight (calls Gemini server-side). */
export async function generateInsight(
  kind: InsightKind,
  period?: 'weekly' | 'monthly',
): Promise<{ insight: Insight | null; error: string | null }> {
  if (!supabase) return { insight: null, error: 'Cloud sync is not configured.' };
  try {
    const { data, error } = await supabase.functions.invoke('coach', {
      body: { kind, period },
    });
    if (error) {
      // Edge Functions return the response body on non-2xx via context.
      const detail = await readInvokeError(error);
      return { insight: null, error: detail };
    }
    return { insight: (data?.insight as Insight) ?? null, error: null };
  } catch (e) {
    return { insight: null, error: String(e) };
  }
}

/** Most recent stored insight of a kind, shown instantly before refreshing. */
export async function latestInsight(kind: InsightKind): Promise<Insight | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('coach_insights')
      .select('*')
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as Insight) ?? null;
  } catch {
    return null;
  }
}

async function readInvokeError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.text === 'function') {
    try {
      const body = await ctx.text();
      const parsed = JSON.parse(body);
      if (parsed?.error) return String(parsed.error);
    } catch {
      /* fall through */
    }
  }
  return (error as { message?: string })?.message ?? 'Failed to reach the coach.';
}
