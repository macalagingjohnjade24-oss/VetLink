/**
 * The paste-ready files in supabase/setup/ must work the way a person uses them:
 * 01_schema.sql pasted whole into an empty project, then 02_dev_seed.sql.
 * A stale bundle (a migration added without re-running build.mjs) fails here.
 */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { PRELUDE } from './harness.mjs';

const setup = new URL('../setup/', import.meta.url);

test('the schema bundle carries every migration on disk', async () => {
  const schema = await readFile(new URL('01_schema.sql', setup), 'utf8');
  const migrations = (await readdir(new URL('../migrations/', import.meta.url))).filter((name) =>
    /^\d{4}_.+\.sql$/.test(name),
  );
  for (const file of migrations) assert.ok(schema.includes(`>>> ${file}`), `${file} is missing; run build.mjs`);
});

test('schema then seed apply to an empty database in one paste each', async () => {
  const db = new PGlite();
  await db.exec(PRELUDE);
  // PGlite has no pgcrypto; the prelude stubs what the schema uses from it.
  const schema = (await readFile(new URL('01_schema.sql', setup), 'utf8')).replace(
    /create extension[^;]*;/gi,
    '',
  );
  await db.exec(schema);
  const seed = await readFile(new URL('02_dev_seed.sql', setup), 'utf8');
  await db.exec(seed);
  // Pasting the seed twice must not fail or duplicate the administrator.
  await db.exec(seed);

  const { rows } = await db.query(`
    select
      (select count(*)::int from public.clinics) as clinics,
      (select count(*)::int from public.profiles where role = 'system_administrator') as admins,
      (select count(*)::int from information_schema.tables
        where table_schema = 'public' and table_name = 'clinic_tasks') as tasks_table
  `);
  assert.equal(rows[0].clinics, 3, 'two sample clinics plus the demo clinic');
  assert.equal(rows[0].admins, 1);
  assert.equal(rows[0].tasks_table, 1);
  await db.close();
});
