/**
 * Speech-to-Text Companion (input suara untuk pesan ke AI Companion).
 *
 * Modul ini native: sebelum memuatnya kita CEK dulu keberadaan modul native
 * lewat requireOptionalNativeModule — sehingga di Expo Go/web kita tidak
 * pernah `require('expo-speech-recognition')` (paket itu melempar error saat
 * import bila modul native tidak ada, dan exception itu tercatat sebagai error
 * besar di Metro). Audio mentah tidak disimpan; hanya transkrip teks yang
 * bisa diedit pasien sebelum dikirim.
 */
import { requireOptionalNativeModule } from 'expo';

type SpeechModule = {
  ExpoSpeechRecognitionModule: {
    start: (options: { lang: string; interimResults?: boolean; continuous?: boolean }) => void;
    stop: () => void;
    requestPermissionsAsync: () => Promise<{ granted: boolean }>;
    addListener: (
      event: 'result' | 'end' | 'error',
      listener: (event: { results?: { transcript?: string }[]; error?: string }) => void,
    ) => { remove: () => void };
  };
};

let cached: SpeechModule | null | undefined;

/** True hanya bila modul native tersedia (development build, bukan Expo Go). */
export function isSpeechRecognitionSupported(): boolean {
  try {
    return requireOptionalNativeModule('ExpoSpeechRecognition') != null;
  } catch {
    return false;
  }
}

export function getSpeechRecognition(): SpeechModule | null {
  if (cached !== undefined) return cached;
  if (!isSpeechRecognitionSupported()) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-speech-recognition') as SpeechModule;
  } catch {
    cached = null;
  }
  return cached;
}

export async function ensureSttPermission(): Promise<boolean> {
  const module = getSpeechRecognition();
  if (!module) return false;
  try {
    const result = await module.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}
