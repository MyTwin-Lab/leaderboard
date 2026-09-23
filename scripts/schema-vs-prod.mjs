// Diff entre le schema Drizzle local (drizzle.ts) et le dump de prod.
// Usage: node scripts/schema-vs-prod.mjs <dump.sql>
import {readFileSync} from 'fs';

const DUMP = process.argv[2];

// --- Schema local : parse des blocs pgTable("nom", { col: ... }) ---
const src = readFileSync('packages/database-service/db/drizzle.ts', 'utf8');
const local = new Map();
const re = /export const (\w+) = pgTable\(\s*["'](\w+)["']\s*,\s*\{/g;
let m;
while ((m = re.exec(src))) {
  const start = re.lastIndex;
  let depth = 1, i = start;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  const body = src.slice(start, i - 1);
  // Colonnes = cles au premier niveau d'imbrication
  const cols = [];
  let d = 0;
  for (const line of body.split('\n')) {
    if (d === 0) {
      // Le nom SQL est le 1er argument du type — `uuid: uuid('id')` => colonne `id`.
      // Sans argument (`meta: json()`), la cle JS fait foi.
      const c = /^\s*["']?([a-zA-Z_][\w]*)["']?\s*:\s*\w+\(\s*(?:["']([^"']+)["'])?/.exec(line);
      if (c) cols.push(c[2] || c[1]);
    }
    for (const ch of line) { if ('{(['.includes(ch)) d++; else if ('})]'.includes(ch)) d--; }
  }
  local.set(m[2], cols);
}

// --- Prod : parse des COPY du dump ---
const prod = new Map();
const lines = readFileSync(DUMP, 'utf8').split('\n');
for (const line of lines) {
  const c = /^COPY public\.(\S+) \((.*)\) FROM stdin;/.exec(line);
  if (c) prod.set(c[1].replace(/"/g, ''), c[2].split(', ').map(x => x.replace(/"/g, '')));
}

// --- Diff ---
const onlyLocal = [...local.keys()].filter(t => !prod.has(t)).sort();
const onlyProd = [...prod.keys()].filter(t => !local.has(t)).sort();

console.log(`Schema local : ${local.size} tables | Prod : ${prod.size} tables\n`);

console.log('=== TABLES ABSENTES EN PROD (schema local en avance) ===');
for (const t of onlyLocal) console.log(`  + ${t}  [${local.get(t).join(', ')}]`);
if (!onlyLocal.length) console.log('  (aucune)');

console.log('\n=== TABLES EN PROD ABSENTES DU SCHEMA LOCAL ===');
for (const t of onlyProd) console.log(`  - ${t}`);
if (!onlyProd.length) console.log('  (aucune)');

console.log('\n=== COLONNES DIVERGENTES ===');
let any = false;
for (const [t, cols] of [...local].sort()) {
  if (!prod.has(t)) continue;
  const pc = prod.get(t);
  const addedLocal = cols.filter(c => !pc.includes(c));
  const missingLocal = pc.filter(c => !cols.includes(c));
  if (addedLocal.length || missingLocal.length) {
    any = true;
    console.log(`  ${t}`);
    if (addedLocal.length) console.log(`     + local seulement : ${addedLocal.join(', ')}`);
    if (missingLocal.length) console.log(`     - prod seulement  : ${missingLocal.join(', ')}`);
  }
}
if (!any) console.log('  (aucune)');
