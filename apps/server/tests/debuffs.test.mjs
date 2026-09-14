import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { createApp } from '../src/app.ts';

test('search exposes documented enemy debuffs with awakening availability', async () => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Requires an isolated test database');
  const readiness = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { await readiness.query('SELECT 1'); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 500)); }
    }
    assert.ok(ready, 'Isolated test database must become ready');
  } finally { await readiness.end(); }
  for (const script of ['migrate.mjs', 'import-data.mjs']) {
    const result = spawnSync(process.execPath, [new URL('../scripts/' + script, import.meta.url).pathname], {
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  }
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const app = createApp(pool);
  const list = async (suffix = '') => {
    const response = await app.inject('/api/characters' + suffix);
    assert.equal(response.statusCode, 200);
    return response.json().items;
  };
  try {
    const all = await list();
    assert.equal((await app.inject('/api/characters?debuff=invalid')).statusCode, 400);
    assert.deepEqual((await list('?debuff=def')).map(c => c.id), ['aidan', 'baal', 'cristian']);
    assert.deepEqual((await list('?debuff=elemental_res')).map(c => c.id), ['cristian']);
    const damage = await list('?debuff=dmg_bonus');
    assert.ok(damage.some(c => c.id === 'autrey'));
    assert.ok(!damage.some(c => c.id === 'erka'));
    assert.deepEqual((await list('?buff=atk&debuff=def&target=all_allies')).map(c => c.id), ['aidan']);
    assert.equal((await list('?debuff=def&element=water')).length, 0);
    assert.ok((await list('?debuff=dmg_bonus&awakening=5')).every(c => c.debuffs.some(e => e.stat_code === 'dmg_bonus')));
    const autrey = all.find(c => c.id === 'autrey');
    assert.ok(autrey.debuffs.some(e => e.id === 'autrey-flag-damage-0' && Number(e.value) === 40));
    assert.ok(autrey.debuffs.some(e => e.id === 'autrey-flag-damage-5' && Number(e.value) === 80));
    assert.ok(autrey.debuffs.some(e => e.effect_type === 'damage_taken_increase' && e.id.includes('resonance')));
    assert.equal(all.find(c => c.id === 'erka').debuffs.length, 0, 'Resonance dependency does not prove a grant');
    for (const [level, value] of [[0, 40], [5, 80]]) {
      const selected = (await list('?awakening=' + level)).find(c => c.id === 'autrey');
      const flag = selected.debuffs.filter(e => e.id.startsWith('autrey-flag-damage-'));
      assert.equal(flag.length, 1);
      assert.equal(Number(flag[0].value), value);
    }
    assert.ok(all.every(c => c.debuffs.every(e => e.target === 'enemy' && e.effect_type !== 'damage')));
  } finally {
    await app.close();
    await pool.end();
  }
});
