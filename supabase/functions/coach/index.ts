// Supabase Edge Function: "coach"
//
// Reads the caller's habits + completions, computes streak/consistency stats,
// asks Gemini for either a short motivational nudge or a weekly/monthly
// reflection, stores the result in coach_insights, and returns it.
//
// Request body: { kind: 'nudge' | 'reflection', period?: 'weekly' | 'monthly' }
// Auth: the user's Supabase JWT in the Authorization header (sent automatically
// by supabase.functions.invoke on the client).
//
// Self-contained (single file) so it deploys cleanly via the Management API.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// Stats (operate on raw DB rows: completions = { 'YYYY-MM-DD': count })
// ---------------------------------------------------------------------------

type HabitRow = {
  id: string;
  name: string;
  emoji: string;
  type: string; // 'binary' | 'count'
  target: number;
  completions: Record<string, number>;
};

function todayKey(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return todayKey(dt);
}

function isDone(h: HabitRow, date: string): boolean {
  const c = h.completions?.[date] ?? 0;
  return h.type === 'binary' ? c > 0 : c >= h.target;
}

function currentStreak(h: HabitRow): number {
  const today = todayKey();
  let cursor = isDone(h, today) ? today : addDays(today, -1);
  let s = 0;
  while (isDone(h, cursor)) {
    s += 1;
    cursor = addDays(cursor, -1);
  }
  return s;
}

function consistency(h: HabitRow, days: number): number {
  const today = todayKey();
  let done = 0;
  for (let i = 0; i < days; i++) {
    if (isDone(h, addDays(today, -i))) done += 1;
  }
  return Math.round((done / days) * 100);
}

type HabitStat = {
  name: string;
  emoji: string;
  streak: number;
  consistency7: number;
  consistency30: number;
  doneToday: boolean;
};

function summarize(habits: HabitRow[], windowDays: number) {
  const today = todayKey();
  const perHabit: HabitStat[] = habits.map((h) => ({
    name: h.name,
    emoji: h.emoji,
    streak: currentStreak(h),
    consistency7: consistency(h, 7),
    consistency30: consistency(h, 30),
    doneToday: isDone(h, today),
  }));

  let activeDays = 0;
  for (let i = 0; i < windowDays; i++) {
    const date = addDays(today, -i);
    if (habits.some((h) => isDone(h, date))) activeDays += 1;
  }

  const byConsistency = [...perHabit].sort((a, b) => b.consistency30 - a.consistency30);
  const best = byConsistency[0] ?? null;
  const worst = byConsistency[byConsistency.length - 1] ?? null;

  return { perHabit, best, worst, activeDays, windowDays, habitCount: habits.length };
}

type Stats = ReturnType<typeof summarize>;

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

async function callGemini(prompt: string): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text');
  return text.trim();
}

function nudgePrompt(stats: Stats): string {
  const lines = stats.perHabit
    .map(
      (h) =>
        `- ${h.emoji} ${h.name}: ${h.streak}-day streak, ${h.consistency7}% this week, ${h.consistency30}% this month, ${h.doneToday ? 'done today' : 'not done today'}`,
    )
    .join('\n');
  return `You are a warm, concise habit coach. Based on this user's data, write ONE short motivational message (2-3 sentences, max ~45 words). Celebrate a specific win, gently flag one habit that's slipping, and give one tiny concrete tip. Encouraging tone, at most one emoji. Plain sentences — no markdown headers or lists.

Habits:
${lines || '(no habits yet)'}`;
}

function reflectionPrompt(stats: Stats, period: string): string {
  const lines = stats.perHabit
    .map((h) => `- ${h.emoji} ${h.name}: ${h.consistency30}% consistent, current streak ${h.streak}`)
    .join('\n');
  return `You are a thoughtful habit coach writing a ${period} reflection report. Write 3-4 short sentences (max ~90 words). Summarize the last ${stats.windowDays} days: name the habit they were most consistent with and one that dropped off, note active days (${stats.activeDays}/${stats.windowDays}), and end with one forward-looking suggestion. Warm, specific, plain sentences — no markdown headers or bullet lists.

Habits (last 30 days):
${lines || '(no habits yet)'}
Most consistent: ${stats.best ? stats.best.name : 'n/a'}
Least consistent: ${stats.worst ? stats.worst.name : 'n/a'}`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY not set' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing auth' }, 401);

  // Client scoped to the caller's JWT so RLS applies to every query.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Invalid session' }, 401);
  const userId = userData.user.id;

  let body: { kind?: string; period?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* default to nudge */
  }
  const kind = body.kind === 'reflection' ? 'reflection' : 'nudge';
  const period = body.period === 'monthly' ? 'monthly' : 'weekly';
  const windowDays = kind === 'reflection' ? (period === 'monthly' ? 30 : 7) : 7;

  const { data: habits, error: habitsErr } = await supabase
    .from('habits')
    .select('id,name,emoji,type,target,completions')
    .is('deleted_at', null);
  if (habitsErr) return json({ error: habitsErr.message }, 500);

  const stats = summarize((habits ?? []) as HabitRow[], windowDays);

  let content: string;
  try {
    const prompt = kind === 'reflection' ? reflectionPrompt(stats, period) : nudgePrompt(stats);
    content = await callGemini(prompt);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }

  const { data: inserted, error: insErr } = await supabase
    .from('coach_insights')
    .insert({
      user_id: userId,
      kind,
      period: kind === 'reflection' ? period : null,
      content,
      stats: {
        habitCount: stats.habitCount,
        activeDays: stats.activeDays,
        windowDays: stats.windowDays,
        best: stats.best?.name ?? null,
        worst: stats.worst?.name ?? null,
      },
    })
    .select()
    .single();
  if (insErr) return json({ error: insErr.message }, 500);

  return json({ insight: inserted });
});
