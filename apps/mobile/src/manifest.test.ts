import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Manifest', () => {
  it('AC-18: public/manifest.webmanifest has correct id, name, start_url, scope, display, and 192/512 icons', () => {
    const manifestPath = resolve(__dirname, '../public/manifest.webmanifest');
    expect(existsSync(manifestPath)).toBe(true);

    const raw = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);

    expect(manifest.id).toBe('/app/');
    expect(manifest.name).toBe('MONSPORT');
    expect(manifest.start_url).toBe('/app/');
    expect(manifest.scope).toBe('/app/');
    expect(manifest.display).toBe('standalone');

    const icons = manifest.icons as Array<{ src: string; sizes: string; type: string }>;
    expect(Array.isArray(icons)).toBe(true);

    const icon192 = icons.find((i) => i.sizes === '192x192');
    const icon512 = icons.find((i) => i.sizes === '512x512');

    expect(icon192).toBeDefined();
    expect(icon512).toBeDefined();

    const icon192Path = resolve(__dirname, '../public/icon-192.png');
    const icon512Path = resolve(__dirname, '../public/icon-512.png');
    expect(existsSync(icon192Path)).toBe(true);
    expect(existsSync(icon512Path)).toBe(true);
  });
});
