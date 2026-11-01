import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, '/');
assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));

for (const icon of manifest.icons) {
  const path = `public${icon.src}`;
  const png = readFileSync(path);
  assert.equal(png.subarray(1, 4).toString(), 'PNG', `${path} must be a real PNG`);
  const [expectedWidth, expectedHeight] = icon.sizes.split('x').map(Number);
  assert.equal(png.readUInt32BE(16), expectedWidth, `${path} width`);
  assert.equal(png.readUInt32BE(20), expectedHeight, `${path} height`);
}

const worker = readFileSync('public/sw.js', 'utf8');
assert.match(worker, /SKIP_WAITING/);
assert.match(worker, /request\.mode === 'navigate'/);
assert.match(worker, /url\.origin !== self\.location\.origin/);
assert.doesNotMatch(worker, /indexedDB|localStorage/);
const html = readFileSync('index.html', 'utf8');
assert.match(html, /rel="manifest"/);
assert.match(html, /apple-touch-icon/);
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const workerHeaders = vercel.headers.find((entry) => entry.source === '/sw.js')?.headers ?? [];
assert.ok(workerHeaders.some((header) => header.key === 'Cache-Control' && header.value.includes('must-revalidate')));

if (existsSync('dist')) {
  for (const file of ['sw.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']) {
    assert.ok(existsSync(`dist/${file}`), `Production output is missing ${file}`);
  }
}
console.log('PWA manifest, icons, worker boundaries, and production artifacts validated.');
