/**
 * Builds the paste-ready SQL for a brand-new Supabase project:
 *
 *   setup/01_schema.sql    every migration, in order (tables, RLS, storage, RPCs)
 *   setup/02_dev_seed.sql  OPTIONAL sample clinics + a development System Administrator
 *
 * Run from the repo root:  node supabase/setup/build.mjs
 * Re-run it whenever a migration is added; never edit the outputs by hand.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const migrationsDir = new URL('migrations/', root);

const migrations = (await readdir(migrationsDir)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();

const banner = (title, lines) =>
  [
    '-- ============================================================================',
    `-- ${title}`,
    ...lines.map((line) => `-- ${line}`),
    '-- ============================================================================',
    '',
  ].join('\n');

let schema = banner('VetLink — full database setup (generated, do not edit)', [
  `Contains migrations ${migrations[0].slice(0, 4)}–${migrations.at(-1).slice(0, 4)} in order.`,
  'Paste the whole file into Supabase → SQL Editor on a NEW project and press Run.',
  'Regenerate with: node supabase/setup/build.mjs',
]);

for (const file of migrations) {
  const sql = await readFile(new URL(file, migrationsDir), 'utf8');
  schema += `\n-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ${file}\n\n${sql.trim()}\n`;
}

let seed =
  banner('VetLink — OPTIONAL development seed (generated, do not edit)', [
    'Run AFTER 01_schema.sql, and only on a development / demo project.',
    'Adds two sample clinics, a System Administrator login, and a demo clinic with',
    'one test login per clinic role plus sample data (credentials in each section).',
  ]);

for (const file of ['seed.dev.sql', 'seed.dev.system-admin.sql', 'seed.dev.test-accounts.sql']) {
  const sql = await readFile(new URL(file, root), 'utf8');
  seed += `\n-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ${file}\n\n${sql.trim()}\n`;
}

await writeFile(new URL('setup/01_schema.sql', root), schema);
await writeFile(new URL('setup/02_dev_seed.sql', root), seed);
console.log(`Wrote 01_schema.sql (${migrations.length} migrations) and 02_dev_seed.sql`);
