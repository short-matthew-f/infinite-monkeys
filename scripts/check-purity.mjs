// Enforces core/ purity rules from DESIGN.md §10: no DOM, no wall clock,
// no unseeded randomness, no imports from game/, sim/, or content/.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  [/\bDate\.now\s*\(/, 'Date.now() (time must be injected as ticks)'],
  [/\bnew Date\s*\(/, 'new Date() (time must be injected as ticks)'],
  [/\bMath\.random\s*\(/, 'Math.random() (use the seeded streams in core/rng.ts)'],
  [/\b(window|document|localStorage|indexedDB|performance)\./, 'browser globals'],
  [/from\s+['"]\.\.\/(game|sim|content)\//, 'imports from game/, sim/, or content/'],
];

let failures = 0;
for (const file of readdirSync('core')) {
  if (!file.endsWith('.ts')) continue;
  const lines = readFileSync(join('core', file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.trim().startsWith('//')) return;
    for (const [re, why] of FORBIDDEN) {
      if (re.test(line)) {
        console.error(`core/${file}:${i + 1}: ${why}`);
        failures++;
      }
    }
  });
}
if (failures) process.exit(1);
console.log('core/ purity: OK');
