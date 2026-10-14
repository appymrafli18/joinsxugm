/**
 * Rasterisasi aset SVG (ekspor Figma, berisi <pattern> + PNG embed) menjadi
 * PNG @1x/@2x/@3x.
 *
 * Kenapa: decoder SVG sistem iOS (CoreSVG via SDWebImage/expo-image) tidak
 * merender <pattern> berisi raster — gambar tidak muncul sama sekali di iOS.
 * Merender offline dengan resvg menghasilkan bitmap yang identik di semua
 * platform.
 *
 * Pakai: node scripts/rasterize-assets.mjs
 * Output: assets/images/raster/<nama>@{1,2,3}x.png
 */
const { Resvg } = require('@resvg/resvg-js');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'images');
const OUT = path.join(SRC, 'raster');

/** Semua SVG yang dipakai layar aplikasi. */
const FILES = [
  'Logo-Splashcreen.svg',
  'illustrations/guardian_onboarding.svg',
  'illustrations/healer_onboarding.svg',
  'illustrations/scholar_onboarding.svg',
  'home/home_asset-hero.svg',
  'home/home_icon-misi.svg',
  'home/home_icon-misi-1.svg',
  'home/home_icon-perjalanan.svg',
  'pilih-arkatipe/arkatipe_guardian.svg',
  'pilih-arkatipe/arkatipe_healer.svg',
  'pilih-arkatipe/arkatipe_scholar.svg',
  'pilih-arkatipe/arkatipe_companion.svg',
  'pilih-arkatipe/asset_bintang.svg',
  'pilih-arkatipe/asset_bintang-2.svg',
  'misi/asset_misi-1.svg',
  'misi/asset_misi-2.svg',
  'misi/asset_misi-3.svg',
  'misi/asset_misi-4.svg',
  'misi/asset_progress.svg',
  'misi/asset_top-bg.svg',
];

fs.mkdirSync(OUT, { recursive: true });

for (const rel of FILES) {
  const input = path.join(SRC, rel);
  const svg = fs.readFileSync(input, 'utf8');

  // Dimensi intrinsik dari atribut width/height SVG.
  const match = svg.match(/<svg[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/);
  if (!match) {
    console.error(`✗ ${rel}: width/height tidak ditemukan, lewati`);
    continue;
  }
  const baseWidth = Math.round(Number(match[1]));

  const name = path.basename(rel, '.svg');
  for (const [suffix, scale] of [
    ['', 1],
    ['@2x', 2],
    ['@3x', 3],
  ]) {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: baseWidth * scale },
      font: { loadSystemFonts: true },
    });
    const png = resvg.render().asPng();
    const outFile = path.join(OUT, `${name}${suffix}.png`);
    fs.writeFileSync(outFile, png);
  }
  console.log(`✓ ${rel} → raster/${name}{,@2x,@3x}.png (${baseWidth}px base)`);
}

console.log('\nSelesai.');
