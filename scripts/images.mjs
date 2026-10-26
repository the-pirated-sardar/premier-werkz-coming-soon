/**
 * Generates the optimized, metadata-free web images in public/images/ from the
 * original photography and logo in assets-source/ (which is git-ignored).
 *
 *   npm run images
 *
 * Run it only when the source photo or logo changes, then commit the results
 * in public/images/ and src/images.json. The deploy workflow never runs this,
 * so the large originals never need to be in the repository.
 *
 * Requires the dev dependency `sharp`, plus `pdftocairo` (brew install poppler)
 * or macOS `sips` to rasterize the PDF logo.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

// ── Sources ──────────────────────────────────────────────────────────────────
const HERO_SOURCE = 'assets-source/photos/DSC02753.jpg';
const LOGO_SOURCE = 'assets-source/logos/gold ( print ready PDF file).pdf';

// Desktop art-direction crop of the (portrait) hero, as fractions of the
// original height. Trims sky and foreground that the wide panel never shows.
const DESKTOP_CROP = { top: 0.08, bottom: 0.92 };

const OUT_DIR = 'public/images';
const MANIFEST = 'src/images.json';
const PAGE_BG = { r: 10, g: 11, b: 14, alpha: 1 }; // keep in sync with --bg in src/styles.css

const HERO_PORTRAIT_WIDTHS = [480, 640, 828, 1080, 1290]; // common phone widths × pixel density
const HERO_DESKTOP_WIDTHS = [800, 1200, 1600, 2000];
const LOGO_WIDTHS = [200, 300, 400, 560];

const QUALITY = {
  avif: { quality: 52, effort: 6, chromaSubsampling: '4:2:0' },
  webp: { quality: 76, effort: 6, smartSubsample: true },
  jpeg: { quality: 78, mozjpeg: true, progressive: true },
  png: { compressionLevel: 9, palette: false },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
for (const p of [HERO_SOURCE, LOGO_SOURCE]) {
  if (!existsSync(p)) {
    console.error(`Missing source file: ${p}\nPut the originals in assets-source/ (see README.md → "Replacing images").`);
    process.exit(1);
  }
}

// Start from a clean folder so renamed/removed variants don't linger.
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
const written = [];

/** Encode `pipeline` (a sharp instance) to every format, recording sizes. sharp strips metadata by default. */
async function encode(pipeline, base, formats) {
  for (const fmt of formats) {
    const file = join(OUT_DIR, `${base}.${fmt === 'jpeg' ? 'jpg' : fmt}`);
    const info = await pipeline.clone()[fmt](QUALITY[fmt]).toFile(file);
    written.push([file, info.size]);
  }
}

/** Rasterize the first page of a PDF to a large transparent PNG. */
function rasterizePdf(pdf, px) {
  const outBase = join(tmpdir(), `pw-logo-${process.pid}`);
  try {
    execFileSync('pdftocairo', ['-png', '-singlefile', '-transp', '-scale-to', String(px), pdf, outBase], { stdio: 'pipe' });
    return `${outBase}.png`;
  } catch {
    execFileSync('sips', ['-s', 'format', 'png', '-Z', String(px), pdf, '--out', `${outBase}.png`], { stdio: 'pipe' });
    return `${outBase}.png`;
  }
}

/** Bounding box of pixels with meaningful alpha (trims transparent padding). */
async function alphaBBox(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Minimal .ico writer: wraps PNG images (supported by every current browser). */
function writeIco(file, pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, buf }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4); // colour planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(buf.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += buf.length;
  });
  const out = Buffer.concat([header, ...pngs.map((p) => p.buf)]);
  writeFileSync(file, out);
  written.push([file, out.length]);
}

// ── Hero photograph ──────────────────────────────────────────────────────────
const hero = sharp(HERO_SOURCE).rotate(); // honour any EXIF orientation before stripping it
const heroMeta = await sharp(HERO_SOURCE).metadata();
const W = heroMeta.width, H = heroMeta.height;

for (const w of HERO_PORTRAIT_WIDTHS) {
  await encode(hero.clone().resize({ width: w }), `hero-portrait-${w}`, ['avif', 'webp', 'jpeg']);
}

const crop = { left: 0, top: Math.round(H * DESKTOP_CROP.top), width: W, height: Math.round(H * (DESKTOP_CROP.bottom - DESKTOP_CROP.top)) };
for (const w of HERO_DESKTOP_WIDTHS) {
  await encode(hero.clone().extract(crop).resize({ width: w }), `hero-desktop-${w}`, ['avif', 'webp', 'jpeg']);
}

// ── Logo ─────────────────────────────────────────────────────────────────────
const logoPng = rasterizePdf(LOGO_SOURCE, 4000);
const bbox = await alphaBBox(logoPng);
const logoMaster = await sharp(logoPng).extract(bbox).png().toBuffer();
rmSync(logoPng, { force: true });
const logoAspect = bbox.width / bbox.height;

// The logo's fine honeycomb texture survives slightly stronger compression than the photo.
const LOGO_QUALITY = { avif: { ...QUALITY.avif, quality: 46 }, webp: { ...QUALITY.webp, quality: 72 } };
for (const w of LOGO_WIDTHS) {
  for (const fmt of ['avif', 'webp']) {
    const file = join(OUT_DIR, `logo-${w}.${fmt}`);
    const info = await sharp(logoMaster).resize({ width: w })[fmt](LOGO_QUALITY[fmt]).toFile(file);
    written.push([file, info.size]);
  }
}
await encode(sharp(logoMaster).resize({ width: 480 }), 'logo-480', ['png']);

// ── Icons: logo centred on the page background ──────────────────────────────
async function icon(size, padRatio) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const logo = await sharp(logoMaster).resize({ width: inner, height: inner, fit: 'inside' }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: PAGE_BG } })
    .composite([{ input: logo, gravity: 'center' }])
    .png(QUALITY.png)
    .toBuffer();
}
const apple = await icon(180, 0.08);
writeFileSync('public/apple-touch-icon.png', apple);
written.push(['public/apple-touch-icon.png', apple.length]);
const icon48 = await icon(48, 0.02);
writeFileSync('public/favicon-48.png', icon48);
written.push(['public/favicon-48.png', icon48.length]);
writeIco('public/favicon.ico', [
  { size: 16, buf: await icon(16, 0) },
  { size: 32, buf: await icon(32, 0) },
  { size: 48, buf: icon48 },
]);

// ── Social share image (1200×630) ────────────────────────────────────────────
const OG_W = 1200, OG_H = 630;
const ogBandH = Math.round(W * (OG_H / OG_W));
const ogTop = Math.round(H * 0.5 - ogBandH * 0.56); // car sits at ~50% of the frame height
const ogPhoto = await hero.clone().extract({ left: 0, top: ogTop, width: W, height: ogBandH }).resize(OG_W, OG_H).toBuffer();
const ogShade = Buffer.from(
  `<svg width="${OG_W}" height="${OG_H}"><defs>
     <linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A0B0E" stop-opacity=".78"/><stop offset=".45" stop-color="#0A0B0E" stop-opacity="0"/></linearGradient>
     <linearGradient id="b" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0A0B0E" stop-opacity=".55"/><stop offset=".35" stop-color="#0A0B0E" stop-opacity="0"/></linearGradient>
   </defs><rect width="100%" height="100%" fill="url(#t)"/><rect width="100%" height="100%" fill="url(#b)"/></svg>`,
);
const ogLogo = await sharp(logoMaster).resize({ width: 230 }).toBuffer();
const og = await sharp(ogPhoto)
  .composite([{ input: ogShade }, { input: ogLogo, top: 34, left: 40 }])
  .jpeg({ ...QUALITY.jpeg, quality: 82 })
  .toFile(join(OUT_DIR, 'og-image.jpg'));
written.push([join(OUT_DIR, 'og-image.jpg'), og.size]);

// ── Manifest consumed by scripts/build.mjs ───────────────────────────────────
const desktopAspect = crop.width / crop.height;
const manifest = {
  hero: {
    portrait: { widths: HERO_PORTRAIT_WIDTHS, width: W, height: H },
    desktop: { widths: HERO_DESKTOP_WIDTHS, width: crop.width, height: crop.height, aspect: +desktopAspect.toFixed(4) },
  },
  logo: { widths: LOGO_WIDTHS, aspect: +logoAspect.toFixed(4) },
  og: { file: 'images/og-image.jpg', width: OG_W, height: OG_H },
};
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

// ── Report ───────────────────────────────────────────────────────────────────
for (const [file, size] of written) console.log(`${kb(size).padStart(7)}  ${file}`);
const total = readdirSync(OUT_DIR).length;
console.log(`\n${total} files in ${OUT_DIR}/, manifest → ${MANIFEST}`);
