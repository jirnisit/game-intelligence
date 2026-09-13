import Fastify from 'fastify';
import type pg from 'pg';

const stats = ['atk', 'def', 'hp', 'max_hp', 'crit_rate', 'crit_dmg', 'dmg_bonus', 'elemental_dmg'];
const levelSchema = { type: 'integer', minimum: 0, maximum: 5 };
const active = (alias: string, level: string) => `${alias}.awakening_from <= ${level} AND (${alias}.awakening_until IS NULL OR ${level} < ${alias}.awakening_until)`;
type Availability = {awakening_from: number; awakening_until: number | null};
const isActive = (row: Availability, level: number) => row.awakening_from <= level && (row.awakening_until === null || level < row.awakening_until);

export function createApp(pool: pg.Pool, logger = false) {
  const app = Fastify({ logger });
  app.setErrorHandler((error, _request, reply) => {
    if (error && typeof error === 'object' && 'validation' in error && error.validation) return reply.code(400).send({ message: 'Invalid filter or awakening level' });
    app.log.error(error);
    return reply.code(503).send({ message: 'Character data is temporarily unavailable' });
  });
  app.get('/api/health', async () => { await pool.query('SELECT 1'); return { status: 'ok', database: 'connected' }; });
  app.get('/api/characters/meta', async () => {
    const [elements, classes, games, reactions] = await Promise.all([
      pool.query('SELECT game_id, code, name FROM elements ORDER BY code'),
      pool.query('SELECT game_id, code, name FROM character_classes ORDER BY code'),
      pool.query('SELECT id, name FROM games ORDER BY id'),
      pool.query(`SELECT r.*, COALESCE((SELECT jsonb_agg(p ORDER BY p.element_a,p.element_b) FROM reaction_pairs p WHERE p.reaction_id=r.id),'[]') AS pairs FROM elemental_reactions r ORDER BY r.code`),
    ]);
    return { elements: elements.rows, classes: classes.rows, games: games.rows, buffStats: stats, reactions: reactions.rows };
  });
  app.get<{Querystring:{game?:string}}>('/api/reactions', {
    schema:{querystring:{type:'object',additionalProperties:false,properties:{game:{type:'string',maxLength:100}}}},
  }, async ({query}) => {
    const rows = await pool.query(`SELECT r.*,
      COALESCE((SELECT jsonb_agg(p ORDER BY p.element_a,p.element_b) FROM reaction_pairs p WHERE p.reaction_id=r.id),'[]') AS pairs,
      COALESCE((SELECT jsonb_agg(e ORDER BY e.id) FROM effects e WHERE e.status_id=r.status_id AND e.character_id IS NULL),'[]') AS effects,
      COALESCE((SELECT jsonb_agg(sr ORDER BY sr.awakening_from) FROM status_rules sr WHERE sr.status_id=r.status_id AND sr.character_id IS NULL),'[]') AS rules
      FROM elemental_reactions r WHERE ($1::text IS NULL OR r.game_id=$1) ORDER BY r.code`, [query.game ?? null]);
    return {items: rows.rows};
  });
  type Filters = { q?: string; game?: string; element?: string; class?: string; buff?: string; target?: string; hold?: boolean; awakening?: number; reaction_with?: string; include_partners?: boolean; limit: number; offset: number };
  app.get<{ Querystring: Filters }>('/api/characters', {
    schema: { querystring: { type: 'object', additionalProperties: false, properties: {
      q: { type: 'string', maxLength: 100 }, game: { type: 'string', maxLength: 100 },
      element: { type: 'string', maxLength: 50 }, class: { type: 'string', maxLength: 50 },
      reaction_with: {type:'string',maxLength:50},
      include_partners: {type:'boolean'},
      buff: { type: 'string', enum: stats }, target: { type: 'string', enum: ['self', 'all_allies'] },
      hold: { type: 'boolean' }, awakening: levelSchema,
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 24 }, offset: { type: 'integer', minimum: 0, maximum: 100000, default: 0 },
    } } },
  }, async ({ query: f }) => {
    const args: unknown[] = [f.awakening ?? null];
    const bind = (value: unknown) => { args.push(value); return `$${args.length}`; };
    const where = ['true'];
    if (f.q) { const p = bind(f.q); where.push(`(strpos(lower(c.name->>'en'),lower(${p}))>0 OR strpos(lower(c.name->>'th'),lower(${p}))>0)`); }
    for (const [key, column] of [['game','game_id'],['class','class_code']] as const) if (f[key]) where.push(`c.${column}=${bind(f[key])}`);
    if (f.element) {
      const p = bind(f.element);
      const partner = f.include_partners ? ` OR EXISTS(SELECT 1 FROM skills sk JOIN skill_elements se ON se.skill_id=sk.id JOIN reaction_pairs rp ON rp.game_id=se.game_id
        WHERE sk.character_id=c.id AND ((rp.element_a=${p} AND rp.element_b=se.element_code) OR (rp.element_b=${p} AND rp.element_a=se.element_code)))` : '';
      where.push(`(c.element_code=${p}${partner})`);
    }
    if (f.hold) where.push('EXISTS (SELECT 1 FROM skills a WHERE a.character_id=c.id AND a.has_hold)');
    if (f.reaction_with) {
      const p=bind(f.reaction_with);
      where.push(`EXISTS(SELECT 1 FROM skills sk JOIN skill_elements se ON se.skill_id=sk.id JOIN reaction_pairs rp ON rp.game_id=se.game_id
        WHERE sk.character_id=c.id AND ((rp.element_a=${p} AND rp.element_b=se.element_code) OR (rp.element_b=${p} AND rp.element_a=se.element_code)))`);
    }
    const availability = `($1::integer IS NULL OR ${active('e','$1')})`;
    if (f.buff || f.target) {
      const conditions = ['e.character_id=c.id',availability];
      if (f.buff) conditions.push(`e.stat_code=${bind(f.buff)}`);
      if (f.target) conditions.push(`e.target=${bind(f.target)}`);
      where.push(`EXISTS (SELECT 1 FROM character_buffs e WHERE ${conditions.join(' AND ')})`);
    }
    const predicate = where.join(' AND ');
    const total = await pool.query(`SELECT count(*)::integer AS total FROM characters c WHERE ($1::integer IS NULL OR $1 BETWEEN 0 AND 5) AND ${predicate}`, args);
    const limit = bind(f.limit), offset = bind(f.offset);
    const rows = await pool.query(`SELECT c.*, cl.name AS class_name, el.name AS element_name,
      EXISTS(SELECT 1 FROM skills a WHERE a.character_id=c.id AND a.has_hold) AS has_hold,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'skill_id',e.skill_id,'status_id',e.status_id,'awakening_level',e.awakening_level,'effect_type','stat_increase','stat_code',e.stat_code,'target',e.target,'value',e.value,'unit',e.unit,'per_stack',e.per_stack,'name',s.name,
        'awakening_from',e.awakening_from,'awakening_until',e.awakening_until,'condition',e.condition) ORDER BY e.stat_code,e.id,e.awakening_from)
        FROM character_buffs e LEFT JOIN statuses s ON s.id=e.status_id
        WHERE e.character_id=c.id AND ${availability}), '[]') AS buffs
      FROM characters c JOIN character_classes cl ON cl.game_id=c.game_id AND cl.code=c.class_code
      JOIN elements el ON el.game_id=c.game_id AND el.code=c.element_code
      WHERE ($1::integer IS NULL OR $1 BETWEEN 0 AND 5) AND ${predicate} ORDER BY c.name->>'en', c.id LIMIT ${limit} OFFSET ${offset}`, args);
    return { items: rows.rows, total: total.rows[0].total, awakening: f.awakening ?? null };
  });
  app.get<{ Params: { id: string }; Querystring: { awakening?: number } }>('/api/characters/:id', {
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', maxLength: 100 } } }, querystring: { type: 'object', additionalProperties: false, properties: { awakening: levelSchema } } },
  }, async ({ params, query }, reply) => {
    const { id } = params; const level = query.awakening ?? 0;
    const character = await pool.query(`SELECT c.*, cl.name class_name, el.name element_name FROM characters c
      JOIN character_classes cl ON cl.game_id=c.game_id AND cl.code=c.class_code
      JOIN elements el ON el.game_id=c.game_id AND el.code=c.element_code WHERE c.id=$1`, [id]);
    if (!character.rowCount) return reply.code(404).send({ message: 'Character not found' });
    const [skills, awakenings, statuses, rules, effects, applications, pairs] = await Promise.all([
      pool.query(`SELECT sk.*, se.element_code AS applied_element FROM skills sk LEFT JOIN skill_elements se ON se.skill_id=sk.id WHERE character_id=$1 ORDER BY array_position(ARRAY['normal_attack','special','elemental','ultimate','support','passive'],category)`, [id]),
      pool.query('SELECT *, level <= $2 AS unlocked FROM awakenings WHERE character_id=$1 ORDER BY level', [id,level]),
      pool.query('SELECT s.* FROM statuses s WHERE EXISTS(SELECT 1 FROM character_statuses cs WHERE cs.status_id=s.id AND cs.character_id=$1) ORDER BY s.code', [id]),
      pool.query('SELECT * FROM character_status_rules WHERE character_id=$1 ORDER BY status_id,awakening_from', [id]),
      pool.query(`SELECT e.*, s.name AS status_name, sk.name AS skill_name, aw.name AS awakening_name FROM character_effects e
        LEFT JOIN statuses s ON s.id=e.status_id LEFT JOIN skills sk ON sk.id=e.skill_id
        LEFT JOIN awakenings aw ON aw.character_id=e.character_id AND aw.level=e.awakening_level
        WHERE e.character_id=$1 ORDER BY e.status_id,e.skill_id,e.stat_code,e.awakening_from,e.id`, [id]),
      pool.query(`SELECT a.*, sk.name, sk.description FROM status_applications a JOIN skills sk ON sk.id=a.skill_id WHERE a.character_id=$1 ORDER BY a.id`,[id]),
      pool.query(`SELECT DISTINCT rp.*, r.name, r.description FROM reaction_pairs rp JOIN elemental_reactions r ON r.id=rp.reaction_id
        JOIN skill_elements se ON se.game_id=rp.game_id AND se.element_code IN (rp.element_a,rp.element_b)
        JOIN skills sk ON sk.id=se.skill_id WHERE sk.character_id=$1 ORDER BY rp.element_a,rp.element_b`,[id]),
    ]);
    const required = (e: {condition: Record<string,unknown>}) => [...new Set([
      ...(Array.isArray(e.condition?.requires_statuses) ? e.condition.requires_statuses : []),
      e.condition?.requires_status,
    ].filter((c):c is string=>typeof c==='string'))];
    const requiredCodes = [...new Set(effects.rows.flatMap(required))];
    const providers = requiredCodes.length ? (await pool.query(`SELECT s.code, c.id AS character_id, c.name AS character_name,
      sk.name AS skill_name, sk.description, a.target, a.stacks, a.condition,a.awakening_from,a.awakening_until
      FROM statuses s JOIN status_applications a ON a.status_id=s.id JOIN characters c ON c.id=a.character_id
      JOIN skills sk ON sk.id=a.skill_id WHERE c.game_id=$1 AND s.code=ANY($2::text[])
      ORDER BY s.code,c.id,a.id`, [character.rows[0].game_id,requiredCodes])).rows : [];
    const variants = effects.rows.flatMap(e => {
      const grants=applications.rows.filter(a=>a.status_id===e.status_id && a.target===e.target
        && Math.max(a.awakening_from,e.awakening_from)<Math.min(a.awakening_until??6,e.awakening_until??6));
      const intervals: Availability[] = [];
      const candidates = e.skill_id || e.awakening_level != null || !grants.length
        ? [{awakening_from:e.awakening_from,awakening_until:e.awakening_until}]
        : grants.map(a => ({awakening_from:Math.max(a.awakening_from,e.awakening_from),awakening_until:Math.min(a.awakening_until??6,e.awakening_until??6)}));
      // Multiple routes to one buff are alternatives, not additional copies.
      for (const candidate of candidates.sort((a,b)=>a.awakening_from-b.awakening_from)) {
        const previous=intervals.at(-1), end=candidate.awakening_until??6;
        if (previous && candidate.awakening_from <= (previous.awakening_until??6)) {
          const mergedEnd=Math.max(previous.awakening_until??6,end);
          previous.awakening_until=mergedEnd===6?null:mergedEnd;
        } else intervals.push({awakening_from:candidate.awakening_from,awakening_until:end===6?null:end});
      }
      return intervals.map(interval=>({...e,...interval,directly_granted:!!e.skill_id || e.awakening_level != null || !!grants.length,
        applications:grants.filter(a=>Math.max(a.awakening_from,interval.awakening_from)<Math.min(a.awakening_until??6,interval.awakening_until??6)),
        required_statuses:required(e).map(code=>({code,providers:providers.filter(p=>p.code===code)}))}));
    });
    const selectedEffects=variants.filter(e=>isActive(e,level)).map(e=>({...e,applications:e.applications.filter((a: Availability)=>isActive(a,level)),required_statuses:e.required_statuses.map((r: {code:string;providers:(pg.QueryResultRow & Availability)[]})=>({...r,providers:r.providers.filter(p=>isActive(p,level))}))}));
    return { ...character.rows[0], awakening: level, skills: skills.rows, awakenings: awakenings.rows,
      statuses: statuses.rows.map(s=>({...s,rule:rules.rows.find(r=>r.status_id===s.id && isActive(r,level))??null,rules:rules.rows.filter(r=>r.status_id===s.id)})),
      effects:selectedEffects,effect_variants:variants,reaction_pairs:pairs.rows };
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
