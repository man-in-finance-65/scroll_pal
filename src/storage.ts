import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pod } from './types';

const PODS_KEY = 'scrollpal:pods';
const GEMINI_KEY = 'scrollpal:geminiKey';

export async function loadPods(): Promise<Pod[]> {
  const raw = await AsyncStorage.getItem(PODS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function savePods(pods: Pod[]): Promise<void> {
  await AsyncStorage.setItem(PODS_KEY, JSON.stringify(pods));
}

// A key typed in Settings wins over the one baked in at build time.
export async function getGeminiKey(): Promise<string> {
  const stored = await AsyncStorage.getItem(GEMINI_KEY);
  return stored || process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
}

export async function setGeminiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(GEMINI_KEY, key.trim());
}
