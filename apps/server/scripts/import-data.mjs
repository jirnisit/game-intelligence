import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// Fixed dependency order and primary keys; never accept SQL identifiers from JSON.
const tables = {
  games: ['id'], character_classes: ['game_id', 'code'], elements: ['game_id', 'code'],
  characters: ['id'], teams: ['id'], skills: ['id'],
  awakenings: ['character_id', 'level'], statuses: ['id'], status_rules: ['id'],
  effects: ['id'], status_applications: ['id'],
};
const input = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../../../database/data/', import.meta.url));
const info = await stat(input).catch(() => { throw new Error('Import path not found. Create database/data JSON files or pass a file/directory path.'); });
const files = info.isDirectory() ? (await readdir(input)).filter(n => n.endsWith('.json')).sort().map(n => join(input, n)) : [input];
if (!files.length) throw new Error('No JSON files found; nothing imported');
const documents = [];
for (const file of files) {
  const doc = JSON.parse(await readFile(file, 'utf8'));
  if (doc.schemaVersion !== 2 || !doc.tables || typeof doc.tables !== 'object' || Array.isArray(doc.tables)) throw new Error(`Invalid import document: ${file}`);
  for (const [table, rows] of Object.entries(doc.tables)) {
    if (!Object.hasOwn(tables, table) || !Array.isArray(rows)) throw new Error(`Invalid table or rows: ${table}`);
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Invalid row in ${table}`);
      if (tables[table].some(key => row[key] == null)) throw new Error(`Missing primary key in ${table}`);
    }
  }
  documents.push(doc);
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(73190421)');
  let count = 0;
  for (const [table, keys] of Object.entries(tables)) {
    const metadata = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER'`, [table]);
    const allowed = new Map(metadata.rows.map(r => [r.column_name, r.data_type]));
    if (!allowed.size) throw new Error(`Missing table ${table}; run migrations first`);
    for (const doc of documents) for (const row of doc.tables[table] ?? []) {
      const columns = Object.keys(row);
      if (columns.some(c => !allowed.has(c))) throw new Error(`Unknown or generated column in ${table}`);
      for (const field of ['name', 'description']) {
        if (allowed.get(field) === 'jsonb' && Object.hasOwn(row, field)) {
          const value = row[field];
          if (!value || typeof value.en !== 'string' || typeof value.th !== 'string') throw new Error(`Expected en/th text for ${table}.${field}`);
        }
      }
      const updates = columns.filter(c => !keys.includes(c));
      const quote = c => '"' + c + '"';
      const conflict = updates.length ? `DO UPDATE SET ${updates.map(c => `${quote(c)}=EXCLUDED.${quote(c)}`).join(',')}` : 'DO NOTHING';
      const statement = `INSERT INTO ${table} (${columns.map(quote).join(',')}) VALUES (${columns.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT (${keys.map(quote).join(',')}) ${conflict}`;
      const values = columns.map(c => allowed.get(c) === 'jsonb' && row[c] != null ? JSON.stringify(row[c]) : row[c]);
      await client.query(statement, values);
      count++;
    }
  }
  // Prevent replacement variants from being counted twice after manual JSON edits.
  const overlap = await client.query(`SELECT 1 FROM status_rules a JOIN status_rules b ON a.status_id=b.status_id AND a.id<b.id WHERE int4range(a.awakening_from,a.awakening_until,'[)') && int4range(b.awakening_from,b.awakening_until,'[)') LIMIT 1`);
  if (overlap.rowCount) throw new Error('Overlapping status rule awakening intervals');
  await client.query('COMMIT');
  console.log(`Imported ${count} rows from ${files.length} JSON file(s). Existing keys updated; no rows deleted.`);
} catch (error) {
  await client.query('ROLLBACK');
  // Avoid printing database detail fields that may echo imported sensitive data.
  throw new Error(`Import rolled back: ${error.message}`);
} finally { await client.end(); }
