# Daily Habits

A minimalist habit tracker built with Expo and React Native. Track one thing a day or several times a day, commit to a challenge, and unlock a tiered reward badge when you finish.

Every check-in fires a light haptic + a soft synthesized chime + a scale-bounce on the check circle. Data lives in local storage for an instant, offline-first experience, and syncs to Supabase in the background when you sign in. Runs fully offline with no account if you skip sign-in.

## Features

- **Today** — daily check-off list. Binary habits get a tap-to-complete circle; volume habits get a `±` counter with a target. Streak per habit. Active-challenge banner at the top.
- **History** — 90-day heatmap of all habits combined, 7-day bar chart with the best day highlighted, per-habit ranking with 30-day strip, all-time stats (Completions · Best streak · Rewards).
- **Challenges** — start a 3, 7, or 21-day challenge on any habit. Progress ring with day dots. Past rewards grid.
- **Habit detail** — 35-day consistency heatmap (SVG), full log, edit or delete.
- **Onboarding** — 4-step intro on first launch: welcome, pick from 5 starter habits, opt into reminders, confirm the auto-issued 3-day challenge.
- **Reward badges** — SVG with radial gradient, tier-based color (Bronze < 7d, Silver 7–13d, Gold ≥ 14d), day-count chip, and the habit's own emoji at the center.
- **Reminders** — local scheduled notifications per habit at a time you pick with the native picker (AM/PM), plus a nightly nudge for active challenges. Works everywhere except Expo Go on Android/iOS SDK 53+ (see below).

## Screenshots

Add screenshots in `docs/` and reference them here.

## Getting started

```bash
npm install
npx expo start
```

Then either:
- **Phone:** install Expo Go for **SDK 56** from https://expo.dev/go (the Play Store / App Store version ships SDK 54 and won't load this) and scan the QR.
- **iOS simulator:** press `i` (needs Xcode).
- **Android emulator:** press `a` (needs Android Studio).
- **Browser:** press `w`.

### Scripts

| Command                 | What it does                                    |
| ----------------------- | ----------------------------------------------- |
| `npm run start`         | Start the Metro dev server                      |
| `npm run ios`           | Open in iOS simulator                           |
| `npm run android`       | Open in Android emulator                        |
| `npm run web`           | Open in browser                                 |
| `npm run lint`          | Run `expo lint` (ESLint)                        |
| `npx tsc --noEmit -p .` | Type-check                                      |
| `npm run reset-project` | Move starter template to `app-example/` and blank `src/app/` |

## Cloud sync & auth (Supabase)

Optional. The app runs local-only until you add Supabase credentials; once configured, users can sign up / log in with email + password and their habits sync across devices.

**1. Create a project** at [supabase.com](https://supabase.com) (free tier is fine).

**2. Run the schema.** In the dashboard: SQL Editor → New query → paste `supabase/schema.sql` → Run. This creates the `habits` and `challenges` tables and Row-Level Security policies so each user can only read/write their own rows.

**3. Add credentials.** Copy `.env.example` to `.env` and fill in from Project Settings → API:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

The anon key is safe to ship in a client — it's public by design and gated by RLS. **Never** put the `service_role` key here. Restart the dev server after editing `.env` (env vars are inlined at bundle time).

**4. (Optional) turn off email confirmation** for faster demo testing: Authentication → Providers → Email → disable "Confirm email". Otherwise sign-up sends a confirmation link before the first login works.

**How sync works:** AsyncStorage is always the UI's source of truth, so every tap is instant and works offline. Each mutation stamps `updatedAt` and schedules a debounced background upsert to Supabase. On login the app pulls remote rows and merges per-row by `updatedAt` (last-write-wins); deletes are soft (a `deletedAt` tombstone) so they propagate. Local data created before signing in is adopted into the account on first login.

## AI coaching (Supabase Edge Functions + Gemini)

Two features, both computed server-side so no LLM key ever ships in the app:

- **Coach nudge** (Today tab) — a short motivational message generated from your streak/consistency data.
- **Weekly reflection** (History tab) — a short report on how the last week went.

Flow: the app calls the `coach` Edge Function with the user's auth token → the function reads that user's habits/completions under RLS, computes stats, prompts **Gemini** (`gemini-2.0-flash` by default) → stores the result in `coach_insights` and returns it. The cards only appear when signed in.

**Deploy:**

1. Run `supabase/coach.sql` in the SQL Editor (creates `coach_insights` + RLS).
2. Deploy the function (needs a Supabase access token, no DB password):
   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy coach --project-ref YOUR_REF
   ```
3. Set the model + a Gemini API key as function secrets (server-side only):
   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_... npx supabase secrets set \
     GEMINI_API_KEY=AIza... GEMINI_MODEL=gemini-2.0-flash --project-ref YOUR_REF
   ```
   Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — it must be a standard AI Studio key (starts with `AIza`) with free-tier quota. `SUPABASE_URL` / `SUPABASE_ANON_KEY` are injected automatically.

To switch models or providers, change `GEMINI_MODEL` (or edit `callGemini` in `supabase/functions/coach/index.ts`).

## Architecture

```
src/
  app/
    _layout.tsx           # providers + Stack + onboarding gate + reward watcher
    onboarding.tsx        # first-run flow
    (tabs)/
      _layout.tsx         # NativeTabs
      index.tsx           # Today
      history.tsx         # History
      challenges.tsx      # Challenges
    habits/
      new.tsx             # new / edit form (modal)
      [id].tsx            # detail
  components/             # HabitRow, ChallengeBanner, ConsistencyChart,
                          # BigHeatmap, WeeklyBars, RewardBadge, RewardModal, …
  lib/
    habits.ts             # types, per-user storage, streak/stat math, v1→v2→v3 migration
    use-habits.tsx        # HabitsProvider + useHabits() — scope-aware, drives sync
    supabase.ts           # Supabase client (null when env not configured)
    auth.tsx              # AuthProvider + useAuth() (email/password, skip-to-offline)
    sync.ts               # push/pull/merge between local store and Supabase
    prefs.ts              # tiny device prefs (auth-skipped flag)
    feedback.tsx          # FeedbackProvider (haptic + audio player)
    notifications.ts      # local notifications (guarded against Expo Go)
    time.ts               # 24h ↔ Date ↔ "7:30 PM"
supabase/
  schema.sql              # tables + Row-Level Security
  constants/
    theme.ts              # Colors, Fonts, Spacing, Palette type
```

State is a single `HabitsProvider` context, persisted to `AsyncStorage` under a per-user key (`habits.v3.<userId>`, or `habits.v3.local` when signed out). The provider re-runs `syncReminders(habits, challenges)` after every store change so notification schedules stay in lockstep with data, and — when signed in — pushes changes to Supabase. A one-time migration lifts any legacy `habits.v1`/`habits.v2` data into the v3 store.

`FeedbackProvider` owns a single long-lived `AudioPlayer` from `expo-audio` and exposes `fire('tick' | 'complete')`. `tick` is a light haptic only; `complete` is a success haptic + chime seek-to-0 + play.

The chime at `assets/sounds/chime.wav` is synthesized from three sine partials (880, 1318.5, 1760 Hz) with an exponential decay — you can regenerate it by editing and re-running `scripts/gen-chime.js` (place that file if you want to iterate on the sound).

## SDK notes — read before upgrading

Pinned to **Expo SDK 56** (`expo ~56.0.15`, RN 0.85, React 19.2).

- **Expo Go on the App Store / Play Store ships SDK 54** — it will refuse to load this project. Install a matching Expo Go for SDK 56 from https://expo.dev/go, or use `eas go`, or run in a simulator.
- **`create-expo-app@latest` currently scaffolds SDK 57** (preview) — do not run it over this project.
- **`expo-notifications` throws at module load in Expo Go on Android SDK 53+.** The `src/lib/notifications.ts` module short-circuits via `Constants.executionEnvironment === 'storeClient'` and dynamic-`require`s the module only when it's safe. If you switch back to a static `import`, the whole app crashes on launch. To actually test reminders, build a development client: `npx eas build --profile development`.

## Deps of note

- `expo-router` — file-based routing, `NativeTabs` from `unstable-native-tabs`
- `expo-audio` — chime playback (requires `setAudioModeAsync({ playsInSilentMode: true })` on iOS)
- `expo-haptics` — light / success haptics
- `expo-notifications` — local scheduled reminders (see caveat above)
- `react-native-svg` — consistency charts, heatmaps, reward badges
- `@react-native-community/datetimepicker` — native time picker with AM/PM
- `@react-native-async-storage/async-storage` — persistence

## License

MIT.
