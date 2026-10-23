// Writes apps/web/src/app/tokens.css from DESIGN.md. Run it by hand when DESIGN.md changes: node scripts/design-tokens.mjs.
// It is not part of pnpm check. The output file says "Generated from DESIGN.md, do not edit".
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'apps', 'web', 'src', 'app', 'tokens.css');

const stdout = execSync('npx -y -p @google/design.md@0.4.0 designmd export --format dtcg DESIGN.md', {
  cwd: root,
  encoding: 'utf8',
});

const tokens = JSON.parse(stdout);

const lines = [
  '/* Generated from DESIGN.md, do not edit. */',
  ':root {',
];

// Colors: --color-<name>
if (tokens.color) {
  for (const [name, entry] of Object.entries(tokens.color)) {
    if (name.startsWith('$')) continue;
    const hex = entry.$value?.hex ?? entry.hex;
    if (hex) {
      lines.push(`  --color-${name}: ${hex};`);
    }
  }
}

// Spacing: --space-<name>
if (tokens.spacing) {
  for (const [name, entry] of Object.entries(tokens.spacing)) {
    if (name.startsWith('$')) continue;
    const val = entry.$value;
    const str = typeof val === 'object' && val !== null ? `${val.value}${val.unit ?? 'px'}` : val;
    if (str !== undefined) {
      lines.push(`  --space-${name}: ${str};`);
    }
  }
}

// Rounded: --radius-<name>
if (tokens.rounded) {
  for (const [name, entry] of Object.entries(tokens.rounded)) {
    if (name.startsWith('$')) continue;
    const val = entry.$value;
    const str = typeof val === 'object' && val !== null ? `${val.value}${val.unit ?? 'px'}` : val;
    if (str !== undefined) {
      lines.push(`  --radius-${name}: ${str};`);
    }
  }
}

// Typography: --font-<name>
// shorthand: font: <weight> <size>/<lineHeight> "Be Vietnam Pro", system-ui, sans-serif
if (tokens.typography) {
  for (const [name, entry] of Object.entries(tokens.typography)) {
    if (name.startsWith('$')) continue;
    const val = entry.$value;
    if (!val) continue;
    const weight = val.fontWeight;
    const size = typeof val.fontSize === 'object' && val.fontSize !== null ? `${val.fontSize.value}${val.fontSize.unit ?? 'px'}` : val.fontSize;
    const lh = typeof val.lineHeight === 'number' ? `${val.lineHeight}px` : val.lineHeight;
    lines.push(`  --font-${name}: ${weight} ${size}/${lh} "Be Vietnam Pro", system-ui, sans-serif;`);
  }
}

lines.push('}');
lines.push('');

writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${outPath}`);
