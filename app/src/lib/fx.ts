import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

// Sound + vibration, always together, and always mirroring each other.
//
// THE TAP STREAK ("Mario jump"): tap once and Pal gives a light knock. Tap again quickly and it's a firmer double.
// Tap a third time (and after) and it's a heavy triple with a rising sound. Stop for a moment and it resets.
// The vibration hits and the sound hits happen at the same moments (HIT_OFFSETS_MS), and the sound files in
// assets/sounds were built with those exact offsets. If you change the offsets, regenerate the sounds.

type Tier = 1 | 2 | 3;
const STREAK_WINDOW_MS = 1200; // pause longer than this and the streak starts over
const HIT_OFFSETS_MS: Record<Tier, number[]> = { 1: [0], 2: [0, 110], 3: [0, 90, 180] };
const HIT_STYLE: Record<Tier, Haptics.ImpactFeedbackStyle[]> = {
  1: [Haptics.ImpactFeedbackStyle.Light],
  2: [Haptics.ImpactFeedbackStyle.Medium, Haptics.ImpactFeedbackStyle.Medium],
  3: [Haptics.ImpactFeedbackStyle.Heavy, Haptics.ImpactFeedbackStyle.Heavy, Haptics.ImpactFeedbackStyle.Heavy],
};

const SOUNDS = {
  hop1: require("../../assets/sounds/hop1.mp3"), // tap streak: knock
  hop2: require("../../assets/sounds/hop2.mp3"), //             double
  hop3: require("../../assets/sounds/hop3.mp3"), //             triple, rising
  nice1: require("../../assets/sounds/nice1.mp3"), // Done: Pal's signature click + sparkle, bigger each tier
  nice2: require("../../assets/sounds/nice2.mp3"),
  nice3: require("../../assets/sounds/nice3.mp3"),
  levelup: require("../../assets/sounds/levelup.mp3"),
  stamp: require("../../assets/sounds/stamp.mp3"),
  whoosh: require("../../assets/sounds/whoosh.mp3"), // recipe digested, plan ready
  soft: require("../../assets/sounds/soft.mp3"), // a skip or a problem. Gentle, never a buzzer.
} as const;
type SoundName = keyof typeof SOUNDS;

const KEY = "scrollpal:fx";
const prefs = { sound: true, vibration: true };
const listeners = new Set<() => void>();
const players: Partial<Record<SoundName, AudioPlayer>> = {};
let started = false;

const native = Platform.OS !== "web";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const emit = () => listeners.forEach((l) => l());

export async function initFx() {
  if (started) return;
  started = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) Object.assign(prefs, JSON.parse(raw));
  } catch {}
  try {
    // playsInSilentMode: true is the important one. With it off, an iPhone on silent (or an Android on vibrate)
    // plays nothing at all, even though the vibrations still work.
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" });
  } catch (e) {
    console.warn("fx: audio mode failed", e);
  }
  // Load every sound up front so the first tap is instant.
  for (const name of Object.keys(SOUNDS) as SoundName[]) {
    try {
      const p = createAudioPlayer(SOUNDS[name]);
      p.volume = 1;
      players[name] = p;
    } catch (e) {
      console.warn(`fx: could not load ${name}`, e);
    }
  }
  emit();
}

export function setPref(key: "sound" | "vibration", value: boolean) {
  prefs[key] = value;
  AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => {});
  emit();
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

function playSound(name: SoundName) {
  if (!prefs.sound) return;
  try {
    const p = (players[name] ??= createAudioPlayer(SOUNDS[name]));
    p.volume = 1;
    p.seekTo(0);
    p.play();
  } catch (e) {
    console.warn(`fx: could not play ${name}`, e);
  }
}

// Every hit of a vibration pattern, on its own timer, so it lines up with the sound.
function vibrateHits(tier: Tier) {
  if (!native || !prefs.vibration) return;
  HIT_OFFSETS_MS[tier].forEach((at, i) => {
    const hit = () => Haptics.impactAsync(HIT_STYLE[tier][i]).catch(() => {});
    if (at === 0) hit();
    else setTimeout(hit, at);
  });
}
const notify = (type: Haptics.NotificationFeedbackType, afterMs = 0) => {
  if (!native || !prefs.vibration) return;
  setTimeout(() => Haptics.notificationAsync(type).catch(() => {}), afterMs);
};

// ---- the streak ----
let streak = 0;
let lastAt = 0;
function nextTier(): Tier {
  const now = Date.now();
  streak = now - lastAt > STREAK_WINDOW_MS ? 1 : streak + 1;
  lastAt = now;
  return Math.min(3, streak) as Tier;
}

export const fx = {
  // Any tap: button, tab chip, checklist tick, poking Pal.
  tap: () => {
    const tier = nextTier();
    vibrateHits(tier);
    playSound(`hop${tier}` as SoundName);
    if (tier === 3) notify(Haptics.NotificationFeedbackType.Success, 260);
  },
  // Done on a cook: the same streak, with Pal's signature sound.
  done: () => {
    const tier = nextTier();
    vibrateHits(tier);
    playSound(`nice${tier}` as SoundName);
    notify(Haptics.NotificationFeedbackType.Success, HIT_OFFSETS_MS[tier].at(-1)! + 90);
  },
  // Level up: rising taps, then the success buzz, under the fanfare.
  levelUp: () => {
    if (native && prefs.vibration) {
      (async () => {
        for (const s of [Haptics.ImpactFeedbackStyle.Light, Haptics.ImpactFeedbackStyle.Medium, Haptics.ImpactFeedbackStyle.Heavy]) {
          await Haptics.impactAsync(s).catch(() => {});
          await wait(85);
        }
        notify(Haptics.NotificationFeedbackType.Success);
      })();
    }
    playSound("levelup");
  },
  stamp: () => {
    if (native && prefs.vibration) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    playSound("stamp");
  },
  // Pal finished digesting a link or building a plan.
  ready: () => {
    notify(Haptics.NotificationFeedbackType.Success);
    playSound("whoosh");
  },
  skip: () => {
    notify(Haptics.NotificationFeedbackType.Warning);
    playSound("soft");
  },
  error: () => {
    notify(Haptics.NotificationFeedbackType.Warning);
    playSound("soft");
  },
  // The "Test" button in settings: plays the biggest tap so you can tell sound and vibration both work.
  test: () => {
    vibrateHits(3);
    playSound("hop3");
    notify(Haptics.NotificationFeedbackType.Success, 260);
  },
};
