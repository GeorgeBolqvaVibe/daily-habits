# Daily Habits

A minimalist habit tracker built with Expo and React Native. Track one thing a day or several times a day, commit to a challenge, and unlock a tiered reward badge when you finish.

Every check-in fires a light haptic + a soft synthesized chime + a scale-bounce on the check circle. Everything persists to local storage — no account, no backend.

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
    habits.ts             # types, storage, streak/stat math, v1→v2 migration
    use-habits.tsx        # HabitsProvider + useHabits() + useChallengeProgress()
    feedback.tsx          # FeedbackProvider (haptic + audio player)
    notifications.ts      # local notifications (guarded against Expo Go)
    time.ts               # 24h ↔ Date ↔ "7:30 PM"
  constants/
    theme.ts              # Colors, Fonts, Spacing, Palette type
```

State is a single `HabitsProvider` context, persisted to `AsyncStorage` under key `habits.v2`. The provider re-runs `syncReminders(habits, challenges)` after every store change so notification schedules stay in lockstep with data. A one-time migration lifts any legacy `habits.v1` array into the v2 store as binary habits.

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
