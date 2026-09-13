import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { createApp } from '../src/app.ts';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to an isolated test database');
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const app=createApp(pool);
before(async()=>{
  let ready=false;
  for(let i=0;i<30;i++) {try{await pool.query('SELECT 1');ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}
  assert.ok(ready,'Test database must be ready');
  for(const file of ['migrate.mjs','import-data.mjs','import-data.mjs']){
    const run=spawnSync(process.execPath,[new URL('../scripts/'+file,import.meta.url).pathname],{env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL},encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
  }
});
after(async()=>{await app.close();await pool.end();});
const get=async(url)=>{const res=await app.inject(url);assert.equal(res.statusCode,200,res.body);return res.json();};
test('returns the three imported characters once, with six skills each',async()=>{
 const list=await get('/api/characters');assert.equal(list.total,3);
 for(const c of list.items){const d=await get('/api/characters/'+c.id);assert.equal(d.skills.length,6);assert.ok(d.skills.every(s=>!('actions' in s)&&!('source_id' in s)));assert.ok(!('sources' in d));}
});
test('ATK self returns Mei, ATK team returns nobody',async()=>{
 assert.deepEqual((await get('/api/characters?buff=atk&target=self')).items.map(c=>c.id),['mei']);
 assert.equal((await get('/api/characters?buff=atk&target=all_allies')).total,0);
});
test('team CRIT DMG comes from Eliade; conditional Eclipse is excluded',async()=>{
 assert.deepEqual((await get('/api/characters?buff=crit_dmg&target=all_allies')).items.map(c=>c.id),['eliade']);
 assert.deepEqual((await get('/api/characters?buff=crit_rate&target=all_allies')).items.map(c=>c.id),['helen']);
 assert.deepEqual((await get('/api/characters?buff=crit_rate&target=self')).items.map(c=>c.id),['mei']);
});
test('HP healing is not an HP stat buff and Collapse is not an ATK buff',async()=>{
 assert.equal((await get('/api/characters?buff=hp')).total,0);
 const m=await get('/api/characters/mei');assert.equal(m.buffs,undefined);
 assert.equal(m.effects.filter(e=>e.effect_type==='stat_increase'&&e.stat_code==='atk').length,1);
});
test('awakening replacement selects 40 or 80, not both',async()=>{
 for(const [level,value] of [[0,40],[1,40],[2,80],[5,80]]){
  const m=await get('/api/characters/mei?awakening='+level);const atk=m.effects.filter(e=>e.effect_type==='stat_increase'&&e.stat_code==='atk');assert.equal(atk.length,1);assert.equal(Number(atk[0].value),value);
 }
 const m=await get('/api/characters/mei?awakening=5');assert.equal(Number(m.effects.find(e=>e.status_id==='mei-collapse').value),400);
});
test('hold is marked on exactly the appropriate main skills',async()=>{
 assert.deepEqual((await get('/api/characters?hold=true')).items.map(c=>c.id),['eliade','mei']);
 const mei=await get('/api/characters/mei');assert.deepEqual(mei.skills.filter(s=>s.has_hold).map(s=>s.category),['normal_attack']);
 assert.match(mei.skills[0].description.en,/Blazing Sun/);assert.match(mei.skills[0].description.en,/Single Ultimate Slash/);
 const e=await get('/api/characters/eliade');assert.deepEqual(e.skills.filter(s=>s.has_hold).map(s=>s.category),['special']);
});
test('search accepts Thai, combines filters, and treats SQL characters literally',async()=>{
 assert.deepEqual((await get('/api/characters?q='+encodeURIComponent('เฮเลน'))).items.map(c=>c.id),['helen']);
 assert.deepEqual((await get('/api/characters?buff=atk&element=light&class=destruction')).items.map(c=>c.id),['mei']);
 assert.equal((await get('/api/characters?q='+encodeURIComponent("' OR 1=1 --"))).total,0);
});
test('validates filters, supports paging and returns 404',async()=>{
 for(const url of ['/api/characters?awakening=9','/api/characters?target=enemy','/api/characters?buff=not_a_stat','/api/characters?limit=0','/api/characters/mei?awakening=-1']) assert.equal((await app.inject(url)).statusCode,400);
 assert.equal((await app.inject('/api/characters/missing')).statusCode,404);
 const list=await get('/api/characters?limit=1&offset=1');assert.equal(list.total,3);assert.equal(list.items.length,1);
});
test('does not expose database internals on connection errors',async()=>{
 const failing=createApp({query:async()=>{throw new Error('private database credentials');}});
 const response=await failing.inject('/api/characters');assert.equal(response.statusCode,503);assert.ok(!response.body.includes('credentials'));await failing.close();
});

test('schema starts with main skills only and no screenshot metadata',async()=>{
 const tables=await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('sources','skill_actions')");
 assert.equal(tables.rowCount,0);
 const columns=await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('source_id','action_id')");
 assert.equal(columns.rowCount,0);
 const migrations=await pool.query('SELECT name FROM schema_migrations ORDER BY name');
 assert.deepEqual(migrations.rows.map(r=>r.name),['001_schema.sql','002_teams.sql']);
});

test('explicit reset recreates empty schema, preserves unrelated tables, and allows import',async()=>{
 await pool.query('CREATE TABLE unrelated_reset_test (id integer)');
 await pool.query('INSERT INTO unrelated_reset_test VALUES (1)');
 const run=(name)=>spawnSync(process.execPath,[new URL('../scripts/'+name,import.meta.url).pathname],{env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL},encoding:'utf8'});
 const reset=run('reset-db.mjs');assert.equal(reset.status,0,reset.stderr);
 assert.equal((await pool.query('SELECT count(*)::int n FROM characters')).rows[0].n,0);
 assert.equal((await pool.query('SELECT count(*)::int n FROM unrelated_reset_test')).rows[0].n,1);
 const migrate=run('migrate.mjs');assert.equal(migrate.status,0,migrate.stderr);assert.match(migrate.stdout,/Already applied/);
 const imported=run('import-data.mjs');assert.equal(imported.status,0,imported.stderr);
 assert.equal((await get('/api/characters')).total,3);
});

test('Eclipse links documented Sun/Moon providers and preserves recipients',async()=>{
 for(const id of ['mei','eliade']){
  const d=await get('/api/characters/'+id);
  const eclipse=d.effects.find(e=>e.status_id===id+'-eclipse');
  const sun=eclipse.required_statuses.find(s=>s.code==='sun').providers;
  const moon=eclipse.required_statuses.find(s=>s.code==='moon').providers;
  assert.deepEqual(sun.map(p=>[p.character_id,p.target,p.stacks]),[['helen','all_allies',null],['mei','self',3]]);
  assert.deepEqual(moon.map(p=>[p.character_id,p.target,p.stacks]),[['eliade','all_allies',1]]);
 }
 const h=await get('/api/characters/helen');assert.ok(h.effects.every(e=>e.required_statuses.length===0));
});

test('Helen Blessing is Sun with stack-scaled team CRIT Rate and Devotion condition',async()=>{
 const h=await get('/api/characters/helen');
 const sun=h.statuses.find(s=>s.code==='sun');assert.ok(sun);assert.equal(sun.rule.max_stacks,5);assert.equal(Number(sun.rule.duration_seconds),15);
 const e=h.effects.find(e=>e.status_id===sun.id&&e.stat_code==='crit_rate');assert.equal(Number(e.value),1.5);assert.equal(e.target,'all_allies');assert.equal(e.per_stack,true);assert.equal(e.directly_granted,true);
 assert.equal(e.applications[0].condition.stacks_equal,'devotion_consumed');
});

test('teams preserve free-form bilingual steps and enforce three distinct same-game characters',async()=>{
 const {rows:[character]}=await pool.query('SELECT game_id FROM characters WHERE id=$1',['helen']);
 const description={en:'1. Prepare\n2. Switch\n\nAny other notes.',th:'1. เตรียมบัฟ\n2. สลับตัว\n3. ทำดาเมจ'};
 const insert=`INSERT INTO teams(id,game_id,name,description,character_1_id,character_2_id,character_3_id) VALUES($1,$2,$3,$4,$5,$6,$7)`;
 const values=['test-team',character.game_id,{en:'Team',th:'ทีม'},description,'helen','mei','eliade'];
 try {
  await pool.query(insert,values);
  const {rows:[team]}=await pool.query('SELECT * FROM teams WHERE id=$1',['test-team']);
  assert.deepEqual(team.description,description);
  assert.deepEqual([team.character_1_id,team.character_2_id,team.character_3_id],['helen','mei','eliade']);
  await assert.rejects(pool.query(insert,['duplicate-team',...values.slice(1,6),'helen']),{code:'23514'});
  await assert.rejects(pool.query(insert,['missing-team',...values.slice(1,6),null]),{code:'23502'});
  await pool.query('INSERT INTO games(id,name) VALUES($1,$2)',['test-other-game',{en:'Other',th:'อื่น'}]);
  await assert.rejects(pool.query(insert,['wrong-game','test-other-game',...values.slice(2)]),{code:'23503'});
  await assert.rejects(pool.query(insert,['bad-name',character.game_id,{en:'Missing Thai'},...values.slice(3)]),{code:'23514'});
 } finally {
  await pool.query('DELETE FROM teams WHERE id=$1',['test-team']);
  await pool.query('DELETE FROM games WHERE id=$1',['test-other-game']);
 }
});

test('team API lists imported team and exposes ordered members and multiline notes',async()=>{
 const list=await get('/api/teams');
 const filtered=await get('/api/teams?game=limit-zero-breakers');
 assert.deepEqual(filtered,list);
 const otherGame=await get('/api/teams?game=missing-game');
 assert.equal(otherGame.total,0);
 assert.deepEqual(otherGame.items,[]);
 assert.ok(list.items.some(t=>t.id==='helen-mei-eliade'));
 const team=await get('/api/teams/helen-mei-eliade');
 assert.deepEqual(team.characters.map(c=>c.id),['helen','mei','eliade']);
 assert.ok(team.description.th.includes('5.'));
 assert.ok(team.description.en.includes('\n'));
 assert.equal((await app.inject('/api/teams/not-found')).statusCode,404);
 assert.equal((await app.inject('/api/teams?limit=0')).statusCode,400);
 const empty=await get('/api/teams?offset=100000');
 assert.equal(empty.items.length,0);
});
