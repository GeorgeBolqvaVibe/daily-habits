import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { ReactNode, createContext, useContext, useEffect, useMemo, useRef } from 'react';

type Kind = 'tick' | 'complete';

type FeedbackContextValue = {
  fire: (kind: Kind) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const chimeSource = require('@/assets/sounds/chime.wav');

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    try {
      playerRef.current = createAudioPlayer(chimeSource);
      playerRef.current.volume = 0.35;
    } catch {}
    return () => {
      try {
        playerRef.current?.remove?.();
      } catch {}
      playerRef.current = null;
    };
  }, []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      fire: (kind) => {
        if (kind === 'tick') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        const p = playerRef.current;
        if (!p) return;
        try {
          p.seekTo(0);
          p.play();
        } catch {}
      },
    }),
    [],
  );

  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) return { fire: () => {} };
  return ctx;
}
