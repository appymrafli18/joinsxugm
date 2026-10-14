/**
 * Interpolasi dua warna hex ala CSS `color-mix(in srgb, A <pct>%, B)`.
 * Dipakai untuk mereplikasi warna turunan di halaman onboarding web.
 */
export function mix(a: string, pct: number, b: string): string {
  const parse = (hex: string): [number, number, number] => {
    const value = hex.replace('#', '');
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  };

  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const weight = pct / 100;
  const toHex = (channel: number) =>
    Math.round(channel).toString(16).padStart(2, '0');

  return `#${toHex(r1 * weight + r2 * (1 - weight))}${toHex(
    g1 * weight + g2 * (1 - weight),
  )}${toHex(b1 * weight + b2 * (1 - weight))}`;
}
