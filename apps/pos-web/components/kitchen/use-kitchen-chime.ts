"use client";

/*
 * Oshxona signali.
 *
 * Fritürning yonida 180 ms, 0.08 gain sinus eshitilmaydi, bundan tashqari
 * Chrome birinchi ijroni FOYDALANUVCHI harakatigacha bloklaydi. Shuning
 * uchun:
 *   - bitta `AudioContext` faqat haqiqiy harakat (bosish/tugma) ustida
 *     yaratiladi va qayta ishlatiladi;
 *   - ochilmaguncha interfeysda "ovozni yoqish" taklifi ko'rinadi;
 *   - signal — bir necha notali, uzunroq va balandroq jiringlash;
 *   - tasdiqlanmagan YANGI chipta turganda takrorlanadi.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type ChimeNote = { frequency: number; at: number; duration: number };

const chimePattern: ChimeNote[] = [
  { frequency: 784, at: 0, duration: 0.26 },
  { frequency: 1047, at: 0.24, duration: 0.26 },
  { frequency: 1319, at: 0.48, duration: 0.32 },
  { frequency: 1047, at: 0.84, duration: 0.26 },
  { frequency: 1319, at: 1.08, duration: 0.42 },
];

const peakGain = 0.55;
const repeatMs = 9000;

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  try {
    return new AudioContextClass();
  } catch {
    return null;
  }
}

export function useKitchenChime({
  soundOn,
  alerting,
}: {
  soundOn: boolean;
  alerting: boolean;
}): { unlocked: boolean; supported: boolean; unlock: () => void } {
  const contextRef = useRef<AudioContext | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [supported, setSupported] = useState(true);

  const unlock = useCallback(() => {
    if (contextRef.current) {
      void contextRef.current.resume().catch(() => undefined);
      setUnlocked(true);
      return;
    }

    const context = createAudioContext();
    if (!context) {
      setSupported(false);
      return;
    }

    contextRef.current = context;
    void context.resume().catch(() => undefined);
    setUnlocked(true);
  }, []);

  const play = useCallback(() => {
    const context = contextRef.current;
    if (!context) return;

    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    try {
      const start = context.currentTime + 0.02;

      for (const note of chimePattern) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const noteStart = start + note.at;
        const noteEnd = noteStart + note.duration;

        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(note.frequency, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.exponentialRampToValueAtTime(peakGain, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteEnd + 0.02);
      }
    } catch {
      // Signal chalinmasa ham ekrandagi chaqnash zaxira sifatida qoladi.
    }
  }, []);

  /*
   * Kontekst faqat haqiqiy harakat ustida yaratiladi. Oshpaz odatda
   * birinchi chiptani bosadi — shu bosish ovozni ham ochib beradi.
   */
  useEffect(() => {
    if (unlocked || !supported || !soundOn) return;

    const handle = () => unlock();
    window.addEventListener("pointerdown", handle, { once: true });
    window.addEventListener("keydown", handle, { once: true });

    return () => {
      window.removeEventListener("pointerdown", handle);
      window.removeEventListener("keydown", handle);
    };
  }, [soundOn, supported, unlock, unlocked]);

  useEffect(() => {
    if (!alerting || !soundOn || !unlocked) return;

    play();
    const timer = window.setInterval(play, repeatMs);

    return () => window.clearInterval(timer);
  }, [alerting, play, soundOn, unlocked]);

  useEffect(
    () => () => {
      const context = contextRef.current;
      contextRef.current = null;
      if (context) void context.close().catch(() => undefined);
    },
    [],
  );

  return { unlocked, supported, unlock };
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
