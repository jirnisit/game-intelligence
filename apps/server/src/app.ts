import Fastify from 'fastify';
import type pg from 'pg';

const stats = ['atk', 'def', 'hp', 'max_hp', 'crit_rate', 'crit_dmg', 'dmg_bonus', 'elemental_dmg'];
const levelSchema = { type: 'integer', minimum: 0, maximum: 5, default: 0 };
const active = (alias: string, level: string) => `${alias}.awakening_from <= ${level} AND (${alias}.awakening_until IS NULL OR ${level} < ${alias}.awakening_until)`;
const grant = (level: string) => `EXISTS (SELECT 1 FROM status_applications a WHERE a.character_id=e.character_id AND a.status_id=e.status_id AND a.target=e.target AND ${active('a', level)})`;
const direct = (level: string) => `(e.skill_id IS NOT NULL OR ${grant(level)})`;

export function createApp(pool: pg.Pool, logger = false) {
  const app = Fastify({ logger });
  app.setErrorHandler((error, _request, reply) => {
    if (error && typeof error === 'object' && 'validation' in error && error.validation) return reply.code(400).send({ message: 'Invalid filter or awakening level' });
    app.log.error(error);
    return reply.code(503).send({ message: 'Character data is temporarily unavailable' });
  });
  app.get('/api/health', async () => { await pool.query('SELECT 1'); return { status: 'ok', database: 'connected' }; });
  app.get('/api/characters/meta', async () => {
    const [elements, classes, games] = await Promise.all([
      pool.query('SELECT game_id, code, name FROM elements ORDER BY code'),
      pool.query('SELECT game_id, code, name FROM character_classes ORDER BY code'),
      pool.query('SELECT id, name FROM games ORDER BY id'),
    ]);
    return { elements: elements.rows, classes: classes.rows, games: games.rows, buffStats: stats };
  });
  type Filters = { q?: string; game?: string; element?: string; class?: string; buff?: string; target?: string; hold?: boolean; awakening: number; limit: number; offset: number };
  app.get<{ Querystring: Filters }>('/api/characters', {
    schema: { querystring: { type: 'object', additionalProperties: false, properties: {
      q: { type: 'string', maxLength: 100 }, game: { type: 'string', maxLength: 100 },
      element: { type: 'string', maxLength: 50 }, class: { type: 'string', maxLength: 50 },
      buff: { type: 'string', enum: stats }, target: { type: 'string', enum: ['self', 'all_allies'] },
      hold: { type: 'boolean' }, awakening: levelSchema,
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 24 }, offset: { type: 'integer', minimum: 0, maximum: 100000, default: 0 },
    } } },
  }, async ({ query: f }) => {
    const args: unknown[] = [f.awakening];
    const bind = (value: unknown) => { args.push(value); return `$${args.length}`; };
    const where = ['true'];
    if (f.q) { const p = bind(f.q); where.push(`(strpos(lower(c.name->>'en'),lower(${p}))>0 OR strpos(lower(c.name->>'th'),lower(${p}))>0)`); }
    for (const [key, column] of [['game','game_id'],['element','element_code'],['class','class_code']] as const) if (f[key]) where.push(`c.${column}=${bind(f[key])}`);
    if (f.hold) where.push('EXISTS (SELECT 1 FROM skills a WHERE a.character_id=c.id AND a.has_hold)');
    if (f.buff || f.target) {
      const conditions = [`e.character_id=c.id`, `e.effect_type='stat_increase'`, active('e', '$1'), direct('$1')];
      if (f.buff) conditions.push(`e.stat_code=${bind(f.buff)}`);
      if (f.target) conditions.push(`e.target=${bind(f.target)}`);
      where.push(`EXISTS (SELECT 1 FROM effects e WHERE ${conditions.join(' AND ')})`);
    }
    const predicate = where.join(' AND ');
    // Include level even when no buff filter is selected, keeping parameter numbering stable.
    const total = await pool.query(`SELECT count(*)::integer AS total FROM characters c WHERE $1::integer BETWEEN 0 AND 5 AND ${predicate}`, args);
    const limit = bind(f.limit), offset = bind(f.offset);
    const rows = await pool.query(`SELECT c.*, cl.name AS class_name, el.name AS element_name,
      EXISTS(SELECT 1 FROM skills a WHERE a.character_id=c.id AND a.has_hold) AS has_hold,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'stat_code',e.stat_code,'target',e.target,'value',e.value,'unit',e.unit,'per_stack',e.per_stack,'name',s.name))
        FROM effects e LEFT JOIN statuses s ON s.id=e.status_id
        WHERE e.character_id=c.id AND e.effect_type='stat_increase' AND ${active('e','$1')} AND ${direct('$1')}), '[]') AS buffs
      FROM characters c JOIN character_classes cl ON cl.game_id=c.game_id AND cl.code=c.class_code
      JOIN elements el ON el.game_id=c.game_id AND el.code=c.element_code
      WHERE ${predicate} ORDER BY c.name->>'en', c.id LIMIT ${limit} OFFSET ${offset}`, args);
    return { items: rows.rows, total: total.rows[0].total, awakening: f.awakening };
  });
  app.get<{ Params: { id: string }; Querystring: { awakening: number } }>('/api/characters/:id', {
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', maxLength: 100 } } }, querystring: { type: 'object', additionalProperties: false, properties: { awakening: levelSchema } } },
  }, async ({ params, query }, reply) => {
    const { id } = params; const level = query.awakening;
    const character = await pool.query(`SELECT c.*, cl.name class_name, el.name element_name FROM characters c
      JOIN character_classes cl ON cl.game_id=c.game_id AND cl.code=c.class_code
      JOIN elements el ON el.game_id=c.game_id AND el.code=c.element_code WHERE c.id=$1`, [id]);
    if (!character.rowCount) return reply.code(404).send({ message: 'Character not found' });
    const [skills, awakenings, statuses, rules, effects] = await Promise.all([
      pool.query(`SELECT * FROM skills WHERE character_id=$1 ORDER BY array_position(ARRAY['normal_attack','special','elemental','ultimate','support','passive'],category)`, [id]),
      pool.query('SELECT *, level <= $2 AS unlocked FROM awakenings WHERE character_id=$1 ORDER BY level', [id,level]),
      pool.query('SELECT * FROM statuses WHERE character_id=$1 ORDER BY code', [id]),
      pool.query(`SELECT * FROM status_rules r WHERE character_id=$1 AND ${active('r','$2')}`, [id,level]),
      pool.query(`SELECT e.*, s.name AS status_name, sa.name AS skill_name, ${direct('$2')} AS directly_granted,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('target',a.target,'stacks',a.stacks,'condition',a.condition,'name',aa.name,'description',aa.description))
          FROM status_applications a JOIN skills aa ON aa.id=a.skill_id
          WHERE a.status_id=e.status_id AND a.character_id=e.character_id AND a.target=e.target AND ${active('a','$2')}),'[]') AS applications
        FROM effects e LEFT JOIN statuses s ON s.id=e.status_id LEFT JOIN skills sa ON sa.id=e.skill_id
        WHERE e.character_id=$1 AND ${active('e','$2')} ORDER BY e.effect_type,e.stat_code,e.id`, [id,level]),
    ]);
    const requiredCodes = [...new Set(effects.rows.flatMap(e => Array.isArray(e.condition?.requires_statuses) ? e.condition.requires_statuses.filter((code: unknown) => typeof code === 'string') : []))];
    const providers = requiredCodes.length ? (await pool.query(`SELECT s.code, c.id AS character_id, c.name AS character_name,
      sk.name AS skill_name, sk.description, a.target, a.stacks, a.condition
      FROM statuses s JOIN characters c ON c.id=s.character_id
      JOIN status_applications a ON a.status_id=s.id AND a.character_id=c.id
      JOIN skills sk ON sk.id=a.skill_id
      WHERE c.game_id=$1 AND s.code=ANY($2::text[]) AND ${active('a','$3')}
      ORDER BY s.code,c.id,a.id`, [character.rows[0].game_id,requiredCodes,level])).rows : [];
    for (const e of effects.rows) {
      e.required_statuses = Array.isArray(e.condition?.requires_statuses)
        ? e.condition.requires_statuses.filter((code: unknown) => typeof code === 'string').map((code: string) => ({code, providers:providers.filter(p=>p.code===code)})) : [];
    }
    return { ...character.rows[0], awakening: level, skills: skills.rows, awakenings: awakenings.rows, statuses: statuses.rows.map(s => ({ ...s, rule: rules.rows.find(r=>r.status_id===s.id) ?? null })), effects: effects.rows };
  });
  const teamSelect = `SELECT t.*, g.name AS game_name,
    (SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY member.slot)
     FROM (VALUES (1,t.character_1_id),(2,t.character_2_id),(3,t.character_3_id)) AS member(slot,id)
     JOIN characters c ON c.id=member.id) AS characters
    FROM teams t JOIN games g ON g.id=t.game_id`;
  app.get<{ Querystring: { game?: string; limit: number; offset: number } }>('/api/teams', {
    schema: { querystring: { type: 'object', additionalProperties: false, properties: {
      game: { type: 'string', maxLength: 100 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 24 },
      offset: { type: 'integer', minimum: 0, maximum: 100000, default: 0 },
    } } },
  }, async ({ query }) => {
    const [items, count] = await Promise.all([
      pool.query(teamSelect + ` WHERE ($1::text IS NULL OR t.game_id=$1) ORDER BY t.name->>'en',t.id LIMIT $2 OFFSET $3`, [query.game ?? null,query.limit,query.offset]),
      pool.query('SELECT count(*)::integer AS total FROM teams WHERE ($1::text IS NULL OR game_id=$1)', [query.game ?? null]),
    ]);
    return { items: items.rows, total: count.rows[0].total };
  });
  app.get<{ Params: { id: string } }>('/api/teams/:id', {
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', maxLength: 100 } } } },
  }, async ({ params }, reply) => {
    const result = await pool.query(teamSelect + ' WHERE t.id=$1', [params.id]);
    if (!result.rowCount) return reply.code(404).send({ message: 'Team not found' });
    return result.rows[0];
  });
  return app;
}
