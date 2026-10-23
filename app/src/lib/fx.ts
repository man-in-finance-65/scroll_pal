import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

// Sound + vibration, always together, and always mirroring each other.
//
// Every sound file has "hits" (the clicks you hear). I measured where each one lands (SOUND_HITS_MS below) and fire
// one vibration on every hit, with a matching strength, so what you hear is what you feel. Louder/bigger sounds get
// firmer vibrations. If you replace a sound file, re-measure its hits and update the table.
//
// THE TAP STREAK ("Mario jump"): tap once and Pal gives a light knock. Tap again quickly and it's a firmer double.
// Tap a third time (and after) and it's a heavy triple with a rising sound. Stop for a moment and it resets.
//
// Phones take a moment to start a sound, while a vibration is instant. AUDIO_LATENCY_MS holds each vibration back
// by that moment so the two land together. If they still feel apart on your phone, nudge this number.

type Tier = 1 | 2 | 3;
type Hit = [atMs: number, strength: Haptics.ImpactFeedbackStyle];
const L = Haptics.ImpactFeedbackStyle.Light;
const M = Haptics.ImpactFeedbackStyle.Medium;
const H = Haptics.ImpactFeedbackStyle.Heavy;
const AUDIO_LATENCY_MS = 70;
const STREAK_WINDOW_MS = 1200; // pause longer than this and the streak starts over

const SOUND_HITS_MS = {
  hop1: [[0, L]],
  hop2: [[0, M], [110, M]],
  hop3: [[0, H], [90, H], [180, H]],
  nice1: [[0, L], [110, M]], // Done: click + sparkle, bigger each tier
  nice2: [[0, M], [110, M]],
  nice3: [[0, H], [90, H], [180, H]],
  levelup: [[0, M], [100, H], [645, M], [720, H]],
  stamp: [[0, M], [105, H]],
  whoosh: [[300, L]],
  soft: [[0, M], [160, L], [295, L]],
} satisfies Record<string, Hit[]>;

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

// One vibration per hit of the sound, each on its own timer.
function feel(name: SoundName, extraAfterMs?: { type: Haptics.NotificationFeedbackType; afterLastHitMs: number }) {
  if (!native || !prefs.vibration) return;
  const hits: Hit[] = SOUND_HITS_MS[name];
  hits.forEach(([at, strength]) => setTimeout(() => Haptics.impactAsync(strength).catch(() => {}), at + AUDIO_LATENCY_MS));
  if (extraAfterMs) {
    const last = hits[hits.length - 1][0];
    setTimeout(() => Haptics.notificationAsync(extraAfterMs.type).catch(() => {}), last + AUDIO_LATENCY_MS + extraAfterMs.afterLastHitMs);
  }
}
const both = (name: SoundName, extra?: { type: Haptics.NotificationFeedbackType; afterLastHitMs: number }) => {
  playSound(name);
  feel(name, extra);
};
const OK = Haptics.NotificationFeedbackType.Success;

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
    both(`hop${tier}` as SoundName, tier === 3 ? { type: OK, afterLastHitMs: 80 } : undefined);
  },
  // Done on a cook: the same streak, with Pal's signature sound.
  done: () => {
    const tier = nextTier();
    both(`nice${tier}` as SoundName, { type: OK, afterLastHitMs: 90 });
  },
  levelUp: () => both("levelup", { type: OK, afterLastHitMs: 90 }),
  stamp: () => both("stamp"),
  // Pal finished digesting a link or building a plan.
  ready: () => both("whoosh", { type: OK, afterLastHitMs: 60 }),
  skip: () => both("soft"),
  error: () => both("soft"),
  // The "Test" button in settings: plays the biggest tap so you can tell sound and vibration both work.
  test: () => both("hop3", { type: OK, afterLastHitMs: 80 }),
};
