/** Warna per kategori quest — dipakai halaman daftar misi & layar eksekusi. */
import type { QuestCategory } from '@/lib/quests';

export type CategoryTheme = {
  card: string;
  border: string;
  tile: string;
  chip: string;
  chipText: string;
  button: string;
  track: string;
  fill: string;
};

/* Warna ESTIMASI dari desain (identik dengan web/components/misi/MisiScreen.tsx). */
export const QUEST_THEMES: Record<QuestCategory, CategoryTheme> = {
  indoor_ringan: {
    card: '#EFE6FB', border: '#E2D5F6', tile: '#E6DAF8',
    chip: '#E3D6F8', chipText: '#7C5BC4', button: '#9E7BE2',
    track: '#DCCFF3', fill: '#B79BEB',
  },
  outdoor_ringan: {
    card: '#FDEDE4', border: '#F8DCCF', tile: '#FBE0D2',
    chip: '#FBD9CB', chipText: '#D9674A', button: '#F2916B',
    track: '#F8DCCF', fill: '#F2916B',
  },
  outdoor_sedang: {
    card: '#EBF3E7', border: '#D9E8D3', tile: '#DDEBD6',
    chip: '#D3E6CB', chipText: '#4F8A56', button: '#6FA06F',
    track: '#D9E8D3', fill: '#6FA06F',
  },
  sosial: {
    card: '#FCE8F0', border: '#F7D3E3', tile: '#F9DDEA',
    chip: '#F9D3E3', chipText: '#D2468A', button: '#DB6AA5',
    track: '#F7D3E3', fill: '#DB6AA5',
  },
};
