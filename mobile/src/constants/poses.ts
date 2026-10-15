import type { ArchetypeId } from './colors';
import type { Expression } from '@/lib/companion';

/**
 * Pose ekspresi avatar Companion — 4 arketipe × 3 ekspresi.
 *
 * Saat ini berisi PLACEHOLDER (salinan gambar arketipe). Ganti 12 file di
 * mobile/assets/images/expressions/ dengan ilustrasi pose asli sesuai
 * spesifikasi di mobile/POSE.md — tanpa perlu mengubah kode ini.
 */
export const EXPRESSION_POSES: Record<ArchetypeId, Record<Expression, number>> = {
  guardian: {
    netral: require('@/assets/images/expressions/guardian-netral.png'),
    senang: require('@/assets/images/expressions/guardian-senang.png'),
    khawatir: require('@/assets/images/expressions/guardian-khawatir.png'),
  },
  healer: {
    netral: require('@/assets/images/expressions/healer-netral.png'),
    senang: require('@/assets/images/expressions/healer-senang.png'),
    khawatir: require('@/assets/images/expressions/healer-khawatir.png'),
  },
  scholar: {
    netral: require('@/assets/images/expressions/scholar-netral.png'),
    senang: require('@/assets/images/expressions/scholar-senang.png'),
    khawatir: require('@/assets/images/expressions/scholar-khawatir.png'),
  },
  companion: {
    netral: require('@/assets/images/expressions/companion-netral.png'),
    senang: require('@/assets/images/expressions/companion-senang.png'),
    khawatir: require('@/assets/images/expressions/companion-khawatir.png'),
  },
};
