import AsyncStorage from '@react-native-async-storage/async-storage';

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const removeStorage = (key: string) => AsyncStorage.removeItem(key);
