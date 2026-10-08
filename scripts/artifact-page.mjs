// Strips a standalone page's document skeleton (doctype, html/head/body tags,
// charset and viewport metas) so it can be published as a full-page Artifact,
// which supplies its own skeleton. Usage: node scripts/artifact-page.mjs <in.html> <out.html> [title]
import { readFileSync, writeFileSync } from 'node:fs';

const [inFile, outFile, title] = process.argv.slice(2);
let s = readFileSync(inFile, 'utf8');
s = s
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body[^>]*>\s*/i, '')
  .replace(/<\/body>\s*/i, '')
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
if (title) s = s.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
writeFileSync(outFile, s);
console.log(`${outFile}: ${s.length} bytes`);
