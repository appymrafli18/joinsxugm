import { Platform } from 'react-native';

import { COLORS } from './colors';

export { COLORS };
export const FONT = 'MochiyPopOne';

export const Colors = {
  light: { text: COLORS.text, background: COLORS.base, backgroundElement: COLORS.guardianCard, backgroundSelected: COLORS.healerCard, textSecondary: 'rgba(59,46,74,0.6)' },
  dark: { text: COLORS.white, background: '#1B1720', backgroundElement: '#2B2433', backgroundSelected: '#493D55', textSecondary: '#C5B8CC' },
} as const;
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export const Fonts = { sans: FONT, serif: 'serif', rounded: FONT, mono: 'monospace' } as const;
export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

export const RADIUS = { card: 20, pill: 999, field: 20, image: 16 } as const;
export const SHADOW = {
  float: Platform.select({
    ios: { shadowColor: COLORS.text, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 4 },
    default: { shadowColor: COLORS.text, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } },
  }),
  cta: Platform.select({
    ios: { shadowColor: COLORS.cta, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 10 } },
    android: { elevation: 5 },
    default: { shadowColor: COLORS.cta, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 10 } },
  }),
};
export const BottomTabInset = Platform.select({ ios: 92, android: 82, default: 82 }) ?? 82;
export const MaxContentWidth = 430;
