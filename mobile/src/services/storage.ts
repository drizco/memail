import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants";
import { HistoryEntry } from "../types";

const MAX_HISTORY = 500;

export async function getEmail(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.EMAIL);
}

export async function saveEmail(email: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.EMAIL, email);
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
  return raw ? JSON.parse(raw) : [];
}

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  const history = await getHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }
  await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const history = await getHistory();
  const filtered = history.filter((e) => e.id !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(filtered));
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.HISTORY);
}
