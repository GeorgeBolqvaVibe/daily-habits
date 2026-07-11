// Supabase Edge Function: "send-daily-nudge"
//
// Iterates users with push tokens, generates a personalized nudge (LLM or
// template) based on their habits, stores it in coach_insights, and sends it
// via the Expo push service. Designed to be invoked by pg_cron on a schedule.
//
// Auth: must be called with the SERVICE_ROLE key (cron does this automatically
// via the SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY it holds).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// Stats (mirrored from coach/index.ts — kept inline so this file deploys alone)
// ---------------------------------------------------------------------------

type HabitRow = {
  id: string;
  name: string;
  emoji: string;
  type: string;
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

type Stats = {
  perHabit: {
    name: string;
    emoji: string;
    streak: number;
    consistency7: number;
    consistency30: number;
    doneToday: boolean;
  }[];
  best: Stats['perHabit'][number] | null;
  worst: Stats['perHabit'][number] | null;
  activeDays: number;
  windowDays: number;
  habitCount: number;
};

function summarize(habits: HabitRow[], windowDays: number): Stats {
  const today = todayKey();
  const perHabit = habits.map((h) => ({
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
  const byC = [...perHabit].sort((a, b) => b.consistency30 - a.consistency30);
  return {
    perHabit,
    best: byC[0] ?? null,
    worst: byC[byC.length - 1] ?? null,
    activeDays,
    windowDays,
    habitCount: habits.length,
  };
}

// ---------------------------------------------------------------------------
// LLM (Groq → Gemini → template)
// ---------------------------------------------------------------------------

function nudgePrompt(stats: Stats): string {
  const lines = stats.perHabit
    .map(
      (h) =>
        `- ${h.emoji} ${h.name}: ${h.streak}-day streak, ${h.consistency7}% this week, ${h.doneToday ? 'done today' : 'not done today'}`,
    )
    .join('\n');
  return `You are a warm, concise habit coach. Write ONE short push-notification-sized message (max ~35 words, 1-2 sentences). Celebrate a specific win, gently flag one habit that's slipping, and add one tiny concrete tip. Encouraging tone, at most one emoji.

Habits:
${lines || '(no habits yet)'}`;
}

function templateNudge(stats: Stats): string {
  if (stats.habitCount === 0) return "Add your first habit and I'll help you build momentum.";
  const { best, worst, perHabit } = stats;
  const parts: string[] = [];
  if (best && best.streak >= 3) {
    parts.push(`${best.emoji} ${best.streak}-day streak on ${best.name} — crushing it.`);
  } else if (best && best.consistency7 >= 50) {
    parts.push(`${best.emoji} ${best.consistency7}% on ${best.name} this week — solid.`);
  }
  const slipping = worst && worst.consistency7 < 40 && worst !== best ? worst : null;
  const missing = perHabit.find((h) => !h.doneToday);
  if (slipping) {
    parts.push(
      `Consider ${slipping.emoji} ${slipping.name} — try it right after ${best?.name ?? 'a habit you already do'}.`,
    );
  } else if (missing) {
    parts.push(`Don't forget ${missing.emoji} ${missing.name} today.`);
  } else {
    parts.push('Keep the momentum going.');
  }
  return parts.join(' ');
}

async function callGroq(prompt: string, key: string): Promise<string> {
  const model = Deno.env.get('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq empty');
  return String(text).trim();
}

async function callGemini(prompt: string, key: string): Promise<string> {
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini empty');
  return String(text).trim();
}

async function generateNudge(stats: Stats): Promise<{ text: string; source: string }> {
  const prompt = nudgePrompt(stats);
  const groq = Deno.env.get('GROQ_API_KEY');
  if (groq) {
    try {
      return { text: await callGroq(prompt, groq), source: 'groq' };
    } catch {
      /* fallthrough */
    }
  }
  const gem = Deno.env.get('GEMINI_API_KEY');
  if (gem) {
    try {
      return { text: await callGemini(prompt, gem), source: 'gemini' };
    } catch {
      /* fallthrough */
    }
  }
  return { text: templateNudge(stats), source: 'template' };
}

// ---------------------------------------------------------------------------
// Expo push
// ---------------------------------------------------------------------------

async function sendExpoPush(
  batches: { to: string; title: string; body: string; data?: unknown }[],
): Promise<{ ok: number; failed: number }> {
  if (batches.length === 0) return { ok: 0, failed: 0 };
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(batches),
  });
  if (!res.ok) return { ok: 0, failed: batches.length };
  const data = await res.json();
  const tickets = Array.isArray(data?.data) ? data.data : [];
  let ok = 0;
  let failed = 0;
  for (const t of tickets) {
    if (t?.status === 'ok') ok += 1;
    else failed += 1;
  }
  return { ok, failed };
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

  // Uses the service role so it can read every user's data + tokens. Keep the
  // secret server-side only.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Read all push tokens; group by user.
  const { data: tokens, error: tokErr } = await supabase
    .from('push_tokens')
    .select('user_id, token, platform');
  if (tokErr) return json({ error: tokErr.message }, 500);

  const perUser = new Map<string, string[]>();
  for (const t of tokens ?? []) {
    const list = perUser.get(t.user_id) ?? [];
    list.push(t.token);
    perUser.set(t.user_id, list);
  }

  const results: { user_id: string; source: string; sent: number; failed: number }[] = [];
  const messages: { to: string; title: string; body: string; data?: unknown }[] = [];

  for (const [userId, userTokens] of perUser) {
    const { data: habits } = await supabase
      .from('habits')
      .select('id,name,emoji,type,target,completions')
      .eq('user_id', userId)
      .is('deleted_at', null);

    const stats = summarize((habits ?? []) as HabitRow[], 7);
    const { text, source } = await generateNudge(stats);

    // Persist so the app shows the same nudge when opened.
    await supabase.from('coach_insights').insert({
      user_id: userId,
      kind: 'nudge',
      period: null,
      content: text,
      stats: {
        habitCount: stats.habitCount,
        activeDays: stats.activeDays,
        source,
        via: 'push',
      },
    });

    for (const to of userTokens) {
      messages.push({
        to,
        title: '✨ Your coach',
        body: text,
        data: { kind: 'nudge' },
      });
    }
    results.push({ user_id: userId, source, sent: userTokens.length, failed: 0 });
  }

  // Expo accepts up to 100 messages per request.
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const r = await sendExpoPush(chunk);
    ok += r.ok;
    failed += r.failed;
  }

  return json({ users: perUser.size, messages: messages.length, ok, failed, results });
});
