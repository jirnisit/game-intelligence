import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  await pool.query(readFileSync(new URL('../../../database/verify.sql',import.meta.url),'utf8'));
});
after(async()=>{await app.close();await pool.end();});
const get=async(url)=>{const res=await app.inject(url);assert.equal(res.statusCode,200,res.body);return res.json();};
test('returns the six imported characters once, with six skills each',async()=>{
 const list=await get('/api/characters');assert.equal(list.total,6);
 for(const c of list.items){const d=await get('/api/characters/'+c.id);assert.equal(d.skills.length,6);assert.ok(d.skills.every(s=>!('actions' in s)&&!('source_id' in s)));assert.ok(!('sources' in d));}
});
test('ATK self returns Luni and Mei, ATK team returns nobody',async()=>{
 assert.deepEqual((await get('/api/characters?buff=atk&target=self')).items.map(c=>c.id),['luni','mei']);
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
 assert.deepEqual((await get('/api/characters?hold=true')).items.map(c=>c.id),['autrey','eliade','mei']);
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
 const list=await get('/api/characters?limit=1&offset=1');assert.equal(list.total,6);assert.equal(list.items.length,1);
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
 assert.equal((await get('/api/characters')).total,6);
});

test('Eclipse links documented Sun/Moon providers and preserves recipients',async()=>{
 for(const id of ['mei','eliade']){
  const d=await get('/api/characters/'+id);
  const eclipse=d.effects.find(e=>e.status_id==='mei-eclipse');
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

test('statuses are game-wide definitions, shared by providers and consumers', async()=>{
 assert.equal((await pool.query("SELECT count(*)::int n FROM statuses WHERE code='resonance'")).rows[0].n,1);
 assert.equal((await pool.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_name='statuses' AND column_name='character_id'")).rows[0].n,0);
 for (const id of ['luni','autrey','erka']) {
  const d=await get('/api/characters/'+id);
  assert.ok(d.statuses.some(s=>s.id==='luni-resonance'));
 }
 const e=await get('/api/characters/erka');
 const dependent=e.effect_variants.find(e=>e.id==='erka-special-resonance-ultimate-gauge');
 assert.deepEqual(dependent.required_statuses[0].providers.map(p=>p.character_id),['autrey','luni']);
 const resonance=e.effect_variants.find(e=>e.status_id==='luni-resonance');
 assert.equal(resonance.directly_granted,false);
 assert.deepEqual(resonance.applications,[]);
 const shared=await pool.query("SELECT * FROM effects WHERE status_id='luni-resonance'");
 assert.equal(shared.rowCount,1);assert.equal(shared.rows[0].character_id,null);
});

test('detail returns all awakening variants alongside the selected analysis values', async()=>{
 const mei=await get('/api/characters/mei?awakening=0');
 assert.deepEqual(mei.effect_variants.filter(e=>e.stat_code==='atk').map(e=>[e.awakening_from,Number(e.value)]),[[0,40],[2,80]]);
 assert.equal(mei.effects.filter(e=>e.stat_code==='atk').length,1);
 const all=await get('/api/characters?buff=atk');
 assert.deepEqual(all.items.find(c=>c.id==='mei').buffs.filter(b=>b.stat_code==='atk').map(b=>Number(b.value)).sort((a,b)=>a-b),[40,80]);
 const base=await get('/api/characters?buff=atk&awakening=0');
 assert.deepEqual(base.items.find(c=>c.id==='mei').buffs.filter(b=>b.stat_code==='atk').map(b=>Number(b.value)),[40]);
 const luni=await get('/api/characters/luni');
 assert.equal(luni.statuses.find(s=>s.id==='luni-sharp-blade').rules.length,2);
 const autrey=await get('/api/characters/autrey?awakening=5');
 assert.deepEqual(autrey.effects.filter(e=>e.skill_id==='autrey-ultimate').map(e=>Number(e.value)).sort((a,b)=>a-b),[30,80]);
});

test('an A2-only shared buff is searchable by default and correctly labelled at its acquisition level', async()=>{
 const client=await pool.connect();
 // Use committed fixtures so API pool connections see the records; clean up explicitly.
 try {
  await client.query(`INSERT INTO statuses(id,game_id,code,name,kind,description) VALUES('test-shared-atk','limit-zero-breakers','test_shared_atk','{"en":"Test ATK","th":"ทดสอบ ATK"}','buff','{"en":"Test","th":"ทดสอบ"}')`);
  await client.query(`INSERT INTO character_statuses VALUES('erka','test-shared-atk','all_allies')`);
  await client.query(`INSERT INTO effects(id,status_id,effect_type,stat_code,target,value,unit,description) VALUES('test-shared-effect','test-shared-atk','stat_increase','atk','unknown',20,'percent','{"en":"Test","th":"ทดสอบ"}')`);
  await client.query(`INSERT INTO status_applications(id,character_id,skill_id,status_id,target,stacks,awakening_from) VALUES('test-a2-grant','erka','erka-passive','test-shared-atk','all_allies',1,2)`);
  const all=await get('/api/characters?buff=atk&target=all_allies');
  assert.deepEqual(all.items.map(c=>c.id),['erka']);
  const buff=all.items[0].buffs.find(b=>b.id==='test-shared-effect');assert.equal(buff.awakening_from,2);
  assert.equal((await get('/api/characters?buff=atk&target=all_allies&awakening=0')).total,0);
  assert.equal((await get('/api/characters?buff=atk&target=all_allies&awakening=2')).total,1);
  await client.query(`INSERT INTO status_applications(id,character_id,skill_id,status_id,target,stacks,awakening_from) VALUES('test-a3-grant','erka','erka-elemental','test-shared-atk','all_allies',1,3)`);
  const withAlternative=await get('/api/characters?buff=atk&target=all_allies&awakening=5');
  assert.equal(withAlternative.items[0].buffs.filter(b=>b.id==='test-shared-effect').length,1);
  const detail=await get('/api/characters/erka');
  assert.equal(detail.effect_variants.filter(e=>e.id==='test-shared-effect').length,1);
  assert.ok(!detail.effects.some(e=>e.id==='test-shared-effect'));
  assert.equal(detail.effect_variants.find(e=>e.id==='test-shared-effect').awakening_from,2);
 } finally {
  await client.query("DELETE FROM status_applications WHERE id IN ('test-a2-grant','test-a3-grant')");
  await client.query("DELETE FROM effects WHERE id='test-shared-effect'");
  await client.query("DELETE FROM character_statuses WHERE status_id='test-shared-atk'");
  await client.query("DELETE FROM statuses WHERE id='test-shared-atk'");client.release();
 }
});

test('Fusion search follows documented skill elements in both directions and preserves unknowns', async()=>{
 assert.deepEqual((await get('/api/characters?game=limit-zero-breakers&reaction_with=earth')).items.map(c=>c.id),['autrey','luni']);
 assert.deepEqual((await get('/api/characters?reaction_with=grass')).items.map(c=>c.id),['erka']);
 assert.deepEqual((await get('/api/characters?reaction_with=earth&class=vanguard')).items.map(c=>c.id),['luni']);
 assert.equal((await get('/api/characters?reaction_with=earth&game=missing')).total,0);
 const reactions=(await get('/api/reactions?game=limit-zero-breakers')).items;
 const fusion=reactions.find(r=>r.code==='fusion');assert.equal(fusion.pairs.length,4);
 assert.equal(fusion.window_seconds,null);assert.ok(fusion.effects.every(e=>e.value===null && e.unit===null));
 assert.equal((await get('/api/reactions?game=missing')).items.length,0);
 const intensity=reactions.find(r=>r.code==='intensity');assert.equal(intensity.trigger_kind,'unknown');assert.equal(intensity.pairs.length,0);
 assert.equal(intensity.effects[0].stat_code,'elemental_res');
});

test('same-game shared status references and skill ownership remain enforced', async()=>{
 try {
  await pool.query(`INSERT INTO games VALUES('other-status-game','{"en":"Other","th":"อื่น"}')`);
  await pool.query(`INSERT INTO statuses(id,game_id,code,name,kind,description) VALUES('other-status','other-status-game','other','{"en":"Other","th":"อื่น"}','buff','{"en":"Other","th":"อื่น"}')`);
  await assert.rejects(pool.query("INSERT INTO character_statuses VALUES('mei','other-status','self')"),{code:'23503'});
  await assert.rejects(pool.query("INSERT INTO status_applications(id,character_id,skill_id,status_id,target) VALUES('bad-game','mei','mei-passive','other-status','self')"),{code:'23503'});
  await assert.rejects(pool.query("INSERT INTO status_applications(id,character_id,skill_id,status_id,target) VALUES('bad-skill','mei','helen-passive','helen-blessing','self')"),{code:'23503'});
 } finally {
  await pool.query("DELETE FROM statuses WHERE id='other-status'");await pool.query("DELETE FROM games WHERE id='other-status-game'");
 }
});

test('import rolls back all rows on a late invalid reference and on overlapping scoped rules', async()=>{
 const dir=mkdtempSync(join(tmpdir(),'game-import-'));
 const file=join(dir,'invalid.json');
 const run=()=>spawnSync(process.execPath,[new URL('../scripts/import-data.mjs',import.meta.url).pathname,file],{env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL},encoding:'utf8'});
 try {
  writeFileSync(file,JSON.stringify({schemaVersion:2,tables:{games:[{id:'rollback-game',name:{en:'Rollback',th:'ทดสอบ'}}],status_applications:[{id:'bad-reference',character_id:'mei',skill_id:'helen-passive',status_id:'helen-blessing',target:'self'}]}}));
  assert.notEqual(run().status,0);assert.equal((await pool.query("SELECT 1 FROM games WHERE id='rollback-game'")).rowCount,0);
  writeFileSync(file,JSON.stringify({schemaVersion:2,tables:{status_rules:[{id:'bad-overlap',character_id:'mei',status_id:'helen-blessing',awakening_from:2,awakening_until:null,duration_kind:'unknown'}]}}));
  assert.notEqual(run().status,0);assert.equal((await pool.query("SELECT 1 FROM status_rules WHERE id='bad-overlap'")).rowCount,0);
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('Erka A2 is an independent Break bonus, not a Passive replacement or Awakening-state requirement', async()=>{
 const base=await get('/api/characters/erka?awakening=0');
 const a2=await get('/api/characters/erka?awakening=2');
 const passive=base.effects.filter(e=>e.skill_id==='erka-passive');
 assert.deepEqual(passive.map(e=>Number(e.value)).sort((a,b)=>a-b),[50,100]);
 assert.ok(passive.every(e=>e.condition.requires_status==='awakening'));
 assert.equal(passive.find(e=>Number(e.value)===100).condition.target_state,'break');
 assert.ok(!base.effects.some(e=>e.awakening_level===2));
 const independent=a2.effects.find(e=>e.id==='erka-passive-break-damage-a2');
 assert.equal(independent.awakening_level,2);
 assert.equal(independent.skill_id,null);
 assert.equal(independent.value,'100');
 assert.deepEqual(independent.condition,{target_state:'break'});
 assert.equal(independent.directly_granted,true);
 assert.equal(a2.effects.filter(e=>e.skill_id==='erka-passive').length,2);
 assert.ok(!a2.effects.some(e=>Number(e.value)===200));
 const list=await get('/api/characters?buff=dmg_bonus');
 const buff=list.items.find(c=>c.id==='erka').buffs.find(e=>e.awakening_level===2);
 assert.equal(buff.skill_id,null);assert.deepEqual(buff.condition,{target_state:'break'});
});
