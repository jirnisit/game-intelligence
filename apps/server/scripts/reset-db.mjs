import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const directory = new URL('../../../database/migrations/', import.meta.url);
const migrations = await Promise.all((await readdir(directory))
  .filter(name => /^\d+.*\.sql$/.test(name)).sort()
  .map(async name => ({ name, sql: await readFile(new URL(name, directory), 'utf8') })));
if (!migrations.length) throw new Error('No migrations found; refusing to reset');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(73190421)');
  await client.query('SET LOCAL search_path TO public');
  // Drop only this application's tables. No CASCADE: unrelated dependencies must abort reset.
  await client.query(`DROP TABLE IF EXISTS
    public.teams, public.status_applications, public.effects, public.status_rules, public.statuses,
    public.awakenings, public.skill_actions, public.skills, public.sources,
    public.characters, public.character_classes, public.elements, public.games,
    public.schema_migrations`);
  await client.query('CREATE TABLE schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const { name, sql } of migrations) {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(name, checksum) VALUES ($1, $2)', [name, createHash('sha256').update(sql).digest('hex')]);
  }
  await client.query('COMMIT');
  console.log('Application database reset. Schema recreated; no character data imported.');
} catch (error) {
  await client.query('ROLLBACK');
  throw new Error(`Database reset rolled back: ${error.message}`);
} finally { await client.end(); }
