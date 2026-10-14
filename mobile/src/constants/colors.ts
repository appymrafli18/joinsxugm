export const COLORS = {
  base: '#FBF8FD',
  text: '#3B2E4A',
  cta: '#E3779B',
  sparkle: '#F5D9A6',
  guardian: '#9B82C4',
  guardianCard: '#EDE7F5',
  healer: '#E3A8B5',
  healerCard: '#FBEEF1',
  scholar: '#7B88C4',
  scholarCard: '#EAECF8',
  companion: '#F0A868',
  companionCard: '#FDEFE2',
  sage: '#9CAF88',
  terracotta: '#C1453B',
  white: '#FFFFFF',
  error: '#8F3A57',
  errorRing: '#B04A6A',
} as const;

export type ArchetypeId = 'guardian' | 'healer' | 'scholar' | 'companion';

export const ARCHETYPE_COLORS: Record<ArchetypeId, { main: string; card: string }> = {
  guardian: { main: COLORS.guardian, card: COLORS.guardianCard },
  healer: { main: COLORS.healer, card: COLORS.healerCard },
  scholar: { main: COLORS.scholar, card: COLORS.scholarCard },
  companion: { main: COLORS.companion, card: COLORS.companionCard },
};
