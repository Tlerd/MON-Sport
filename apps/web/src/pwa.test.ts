import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(import.meta.dirname, path));
const text = (path: string) => read(path).toString('utf8');

/** Width and height from the IHDR chunk, after checking the PNG signature. */
function pngSize(path: string) {
  const b = read(path);
  expect([...b.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(b.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

describe('PWA files', () => {
  const manifest = JSON.parse(text('../public/manifest.webmanifest')) as {
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
    lang: string;
    theme_color: string;
    background_color: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };

  it('AC-18: the manifest has the name, start_url "/", display "standalone", and the brand colours', () => {
    expect(manifest.name).toBe('MONSPORT');
    expect(manifest.short_name).toBe('MONSPORT');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('vi');
    expect(manifest.theme_color).toBe('#082f26');
    expect(manifest.background_color).toBe('#0f5c4a');
  });

  it('AC-18: the manifest lists a PNG icon of 192 and of 512, and each file has that size', () => {
    for (const size of [192, 512]) {
      const icon = manifest.icons.find((i) => i.sizes === `${size}x${size}`);
      expect(icon, `icon ${size}`).toBeTruthy();
      expect(icon!.type).toBe('image/png');
      expect(icon!.purpose).toBe('any');
      expect(pngSize(`../public${icon!.src}`)).toEqual({ width: size, height: size });
    }
  });

  it('AC-18: index.html links the manifest and an apple-touch-icon that is a real 180x180 PNG', () => {
    const html = text('../index.html');
    expect(html).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest"\s*\/?>/);
    const touch = html.match(/<link rel="apple-touch-icon" href="([^"]+)"\s*\/?>/);
    expect(touch).toBeTruthy();
    expect(pngSize(`../public${touch![1]}`)).toEqual({ width: 180, height: 180 });
    expect(html).toMatch(/<meta name="theme-color" content="#082f26"\s*\/?>/);
  });
});
