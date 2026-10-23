import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

// Sound + vibration, kept together so every big moment feels the same everywhere.
// Sounds follow the phone's silent switch and mix with the user's music (Pal never pauses a podcast).

const SOUNDS = {
  nice: require("../../assets/sounds/nice.mp3"), // Pal's signature: a pop-click and a sparkle. Done, plan ready.
  levelup: require("../../assets/sounds/levelup.mp3"),
  stamp: require("../../assets/sounds/stamp.mp3"),
  whoosh: require("../../assets/sounds/whoosh.mp3"),
  tick: require("../../assets/sounds/tick.mp3"),
  tap: require("../../assets/sounds/tap.mp3"),
  soft: require("../../assets/sounds/soft.mp3"), // a skip. Gentle, never a buzzer.
} as const;
export type SoundName = keyof typeof SOUNDS;

const KEY = "scrollpal:fx";
const prefs = { sound: true, vibration: true };
const listeners = new Set<() => void>();
const players: Partial<Record<SoundName, AudioPlayer>> = {};
let started = false;

const native = Platform.OS !== "web";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function initFx() {
  if (started) return;
  started = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) Object.assign(prefs, JSON.parse(raw));
  } catch {}
  try {
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" });
  } catch {}
  listeners.forEach((l) => l());
}

export function setPref(key: "sound" | "vibration", value: boolean) {
  prefs[key] = value;
  AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => {});
  listeners.forEach((l) => l());
}

export function useFxPrefs() {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return { ...prefs };
}

export function playSound(name: SoundName) {
  if (!prefs.sound) return;
  try {
    const p = (players[name] ??= createAudioPlayer(SOUNDS[name]));
    p.seekTo(0);
    p.play();
  } catch {}
}

const buzz = {
  select: () => Haptics.selectionAsync(),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  impact: (s: Haptics.ImpactFeedbackStyle) => Haptics.impactAsync(s),
};
const vibrate = (fn: () => Promise<void>) => {
  if (native && prefs.vibration) fn().catch(() => {});
};

// Little patterns, like a heartbeat of "yes!".
async function pattern(steps: [Haptics.ImpactFeedbackStyle, number][]) {
  if (!native || !prefs.vibration) return;
  for (const [style, gap] of steps) {
    await Haptics.impactAsync(style).catch(() => {});
    await wait(gap);
  }
}

export const haptic = {
  tap: () => vibrate(buzz.select),
  success: () => vibrate(buzz.success),
  warn: () => vibrate(buzz.warning),
  // Done: a firm knock, then a light echo.
  pop: () =>
    pattern([
      [Haptics.ImpactFeedbackStyle.Heavy, 70],
      [Haptics.ImpactFeedbackStyle.Light, 0],
    ]),
  // Level up: rising taps, then the success buzz.
  levelUp: async () => {
    await pattern([
      [Haptics.ImpactFeedbackStyle.Light, 80],
      [Haptics.ImpactFeedbackStyle.Medium, 80],
      [Haptics.ImpactFeedbackStyle.Heavy, 110],
    ]);
    vibrate(buzz.success);
  },
};

// Every "amazing action": one call, one vibration, one sound.
export const fx = {
  done: () => { haptic.pop(); playSound("nice"); },
  levelUp: () => { haptic.levelUp(); playSound("levelup"); },
  stamp: () => { vibrate(() => buzz.impact(Haptics.ImpactFeedbackStyle.Heavy)); playSound("stamp"); },
  ready: () => { haptic.success(); playSound("whoosh"); }, // recipe read, plan built, cart ready
  tick: () => { haptic.tap(); playSound("tick"); },
  skip: () => { haptic.warn(); playSound("soft"); },
  tap: () => { haptic.tap(); playSound("tap"); },
  error: () => { haptic.warn(); playSound("soft"); },
};
