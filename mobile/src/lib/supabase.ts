import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/config';

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  {
    auth: {
      storage: Platform.OS === 'web' && typeof window === 'undefined'
        ? { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined }
        : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
