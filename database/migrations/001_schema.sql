CREATE TABLE games (
  id text PRIMARY KEY,
  name jsonb NOT NULL CHECK (jsonb_typeof(name->'en') = 'string' AND jsonb_typeof(name->'th') = 'string')
);
CREATE TABLE character_classes (
  game_id text REFERENCES games(id), code text,
  name jsonb NOT NULL, PRIMARY KEY (game_id, code)
);
CREATE TABLE elements (
  game_id text REFERENCES games(id), code text,
  name jsonb NOT NULL, PRIMARY KEY (game_id, code)
);
CREATE TABLE characters (
  id text PRIMARY KEY, game_id text NOT NULL REFERENCES games(id),
  name jsonb NOT NULL, class_code text NOT NULL, element_code text NOT NULL,
  rarity text, race jsonb, notes jsonb NOT NULL DEFAULT '{}',
  FOREIGN KEY (game_id, class_code) REFERENCES character_classes(game_id, code),
  FOREIGN KEY (game_id, element_code) REFERENCES elements(game_id, code)
);
CREATE INDEX characters_filter ON characters(game_id, element_code, class_code, rarity);
CREATE TABLE skills (
  id text PRIMARY KEY, character_id text NOT NULL REFERENCES characters(id),
  category text NOT NULL CHECK (category IN ('normal_attack','special','elemental','ultimate','support','passive')),
  name jsonb NOT NULL, description jsonb NOT NULL,
  has_hold boolean NOT NULL DEFAULT false,
  cooldown_seconds numeric CHECK (cooldown_seconds >= 0),
  UNIQUE(character_id, category), UNIQUE(character_id, id)
);
CREATE INDEX skills_hold ON skills(character_id) WHERE has_hold;
CREATE TABLE awakenings (
  character_id text REFERENCES characters(id), level integer CHECK (level BETWEEN 1 AND 5),
  name jsonb NOT NULL, description jsonb NOT NULL,
  PRIMARY KEY(character_id, level)
);
CREATE TABLE statuses (
  id text PRIMARY KEY, game_id text NOT NULL REFERENCES games(id),
  code text NOT NULL, name jsonb NOT NULL,
  kind text NOT NULL CHECK (kind IN ('buff','debuff','resource','damage_trigger')),
  description jsonb NOT NULL,
  completeness text NOT NULL DEFAULT 'partial' CHECK (completeness IN ('partial','documented')),
  UNIQUE(game_id, code), UNIQUE(game_id, id)
);
-- Each interval describes a replacement, not an additive awakening bonus.
CREATE TABLE status_rules (
  id text PRIMARY KEY, character_id text REFERENCES characters(id), status_id text NOT NULL REFERENCES statuses(id),
  awakening_from integer NOT NULL DEFAULT 0 CHECK (awakening_from BETWEEN 0 AND 5),
  awakening_until integer CHECK (awakening_until BETWEEN 1 AND 6 AND awakening_until > awakening_from),
  max_stacks integer CHECK (max_stacks > 0),
  duration_seconds numeric CHECK (duration_seconds >= 0),
  duration_kind text NOT NULL CHECK (duration_kind IN ('timed','unlimited','unknown')),
  refresh_on_stack boolean, mechanics jsonb NOT NULL DEFAULT '{}',
  CHECK ((duration_kind = 'timed' AND duration_seconds IS NOT NULL) OR (duration_kind <> 'timed' AND duration_seconds IS NULL)),
  UNIQUE NULLS NOT DISTINCT (status_id, character_id, awakening_from)
);
CREATE TABLE effects (
  id text PRIMARY KEY, character_id text REFERENCES characters(id),
  skill_id text, status_id text REFERENCES statuses(id), awakening_level integer,
  effect_type text NOT NULL CHECK (effect_type IN ('stat_increase','stat_decrease','damage_taken_increase','break_damage_taken_increase','heal','skill_damage_increase','damage','immunity','cooldown_reduction','gauge_recovery')),
  stat_code text CHECK (stat_code IN ('atk','def','hp','max_hp','crit_rate','crit_dmg','dmg_bonus','elemental_dmg','elemental_res','break_gauge','ultimate_gauge','rift_gauge','cooldown','stagger','down')),
  target text NOT NULL CHECK (target IN ('self','all_allies','enemy','unknown')),
  value numeric, unit text CHECK (unit IN ('percent','flat','seconds','percent_of_stat')),
  scaling_stat text, scaling_character_id text REFERENCES characters(id), element_code text,
  per_stack boolean NOT NULL DEFAULT false,
  awakening_from integer NOT NULL DEFAULT 0 CHECK (awakening_from BETWEEN 0 AND 5),
  awakening_until integer CHECK (awakening_until BETWEEN 1 AND 6 AND awakening_until > awakening_from),
  condition jsonb NOT NULL DEFAULT '{}', description jsonb NOT NULL,
  CHECK (num_nonnulls(skill_id, status_id, awakening_level) = 1),
  CHECK ((skill_id IS NULL AND awakening_level IS NULL) OR character_id IS NOT NULL),
  CHECK (awakening_level IS NULL OR awakening_from >= awakening_level),
  CHECK ((value IS NULL) = (unit IS NULL)),
  FOREIGN KEY(character_id, skill_id) REFERENCES skills(character_id, id),
  FOREIGN KEY(character_id, awakening_level) REFERENCES awakenings(character_id, level)
);
CREATE INDEX effects_filter ON effects(effect_type, stat_code, target, character_id, awakening_from);
-- A documented route that grants a status. Merely having a tooltip is not a route.
CREATE TABLE status_applications (
  id text PRIMARY KEY, character_id text NOT NULL, skill_id text NOT NULL, status_id text NOT NULL REFERENCES statuses(id),
  target text NOT NULL CHECK (target IN ('self','all_allies','enemy','unknown')),
  stacks integer CHECK (stacks > 0), condition jsonb NOT NULL DEFAULT '{}',
  awakening_from integer NOT NULL DEFAULT 0 CHECK (awakening_from BETWEEN 0 AND 5),
  awakening_until integer CHECK (awakening_until BETWEEN 1 AND 6 AND awakening_until > awakening_from),
  FOREIGN KEY(character_id, skill_id) REFERENCES skills(character_id, id)
);

-- A status has no character owner. These links describe usage/recipients, including
-- dependencies with no documented application (e.g. Erka needs Resonance).
CREATE TABLE character_statuses (
  character_id text NOT NULL REFERENCES characters(id),
  status_id text NOT NULL REFERENCES statuses(id),
  target text NOT NULL CHECK (target IN ('self','all_allies','enemy','unknown')),
  PRIMARY KEY(character_id,status_id,target)
);
CREATE TABLE skill_elements (
  skill_id text PRIMARY KEY REFERENCES skills(id),
  game_id text NOT NULL,
  element_code text NOT NULL,
  FOREIGN KEY(game_id,element_code) REFERENCES elements(game_id,code)
);
CREATE TABLE elemental_reactions (
  id text PRIMARY KEY, game_id text NOT NULL REFERENCES games(id), code text NOT NULL,
  name jsonb NOT NULL, description jsonb NOT NULL,
  status_id text NOT NULL REFERENCES statuses(id),
  trigger_kind text NOT NULL CHECK(trigger_kind IN ('paired_consecutive','unknown')),
  window_seconds numeric CHECK(window_seconds >= 0),
  UNIQUE(game_id,code), UNIQUE(game_id,id)
);
CREATE TABLE reaction_pairs (
  reaction_id text NOT NULL, game_id text NOT NULL,
  element_a text NOT NULL, element_b text NOT NULL,
  PRIMARY KEY(reaction_id,element_a,element_b),
  CHECK(element_a < element_b),
  FOREIGN KEY(game_id,reaction_id) REFERENCES elemental_reactions(game_id,id),
  FOREIGN KEY(game_id,element_a) REFERENCES elements(game_id,code),
  FOREIGN KEY(game_id,element_b) REFERENCES elements(game_id,code)
);
-- Preserve character/skill ownership and prevent cross-game status links.
CREATE FUNCTION validate_status_game() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.character_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM characters c JOIN statuses s ON s.game_id=c.game_id
    WHERE c.id=NEW.character_id AND s.id=NEW.status_id
  ) THEN RAISE EXCEPTION 'Status and character must belong to the same game' USING ERRCODE='23503'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER status_usage_game BEFORE INSERT OR UPDATE ON character_statuses FOR EACH ROW EXECUTE FUNCTION validate_status_game();
CREATE TRIGGER status_application_game BEFORE INSERT OR UPDATE ON status_applications FOR EACH ROW EXECUTE FUNCTION validate_status_game();
CREATE TRIGGER status_rule_game BEFORE INSERT OR UPDATE ON status_rules FOR EACH ROW EXECUTE FUNCTION validate_status_game();
CREATE TRIGGER status_effect_game BEFORE INSERT OR UPDATE ON effects FOR EACH ROW WHEN (NEW.status_id IS NOT NULL) EXECUTE FUNCTION validate_status_game();
CREATE FUNCTION validate_skill_element_game() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM skills s JOIN characters c ON c.id=s.character_id WHERE s.id=NEW.skill_id AND c.game_id=NEW.game_id)
  THEN RAISE EXCEPTION 'Element and skill must belong to the same game' USING ERRCODE='23503'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER skill_element_game BEFORE INSERT OR UPDATE ON skill_elements FOR EACH ROW EXECUTE FUNCTION validate_skill_element_game();
CREATE FUNCTION validate_reaction_game() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM statuses WHERE id=NEW.status_id AND game_id=NEW.game_id)
  THEN RAISE EXCEPTION 'Reaction and status must belong to the same game' USING ERRCODE='23503'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reaction_game BEFORE INSERT OR UPDATE ON elemental_reactions FOR EACH ROW EXECUTE FUNCTION validate_reaction_game();

-- Resolve common definitions in the context of their recipients. Definitions are
-- stored once; character-specific awakening variants retain their scope.
CREATE VIEW character_effects AS
SELECT e.id, COALESCE(e.character_id,cs.character_id) AS character_id,
 e.skill_id,e.status_id,e.awakening_level,e.effect_type,e.stat_code,
 CASE WHEN e.character_id IS NULL THEN cs.target ELSE e.target END AS target,
 e.value,e.unit,e.scaling_stat,e.scaling_character_id,e.element_code,e.per_stack,
 e.awakening_from,e.awakening_until,e.condition,e.description
FROM effects e LEFT JOIN character_statuses cs ON cs.status_id=e.status_id AND e.character_id IS NULL;
CREATE VIEW character_status_rules AS
SELECT r.id, COALESCE(r.character_id,cs.character_id) AS character_id,r.status_id,
 r.awakening_from,r.awakening_until,r.max_stacks,r.duration_seconds,r.duration_kind,r.refresh_on_stack,r.mechanics
FROM status_rules r LEFT JOIN (SELECT DISTINCT character_id,status_id FROM character_statuses) cs
 ON cs.status_id=r.status_id AND r.character_id IS NULL;
-- Intersect the effect and acquisition intervals. An A2-only grant is never
-- presented as a base buff, even if the shared status itself has a base effect.
CREATE VIEW character_buffs AS
WITH intervals AS (
 SELECT e.id,e.character_id,e.skill_id,e.status_id,e.awakening_level,e.stat_code,e.target,e.value,e.unit,e.per_stack,e.condition,
 int4range(greatest(e.awakening_from,COALESCE(a.awakening_from,0)),
   least(COALESCE(e.awakening_until,6),COALESCE(a.awakening_until,6)),'[)') AS availability
 FROM character_effects e LEFT JOIN status_applications a
  ON a.character_id=e.character_id AND a.status_id=e.status_id AND a.target=e.target
 WHERE e.effect_type='stat_increase' AND (e.skill_id IS NOT NULL OR e.awakening_level IS NOT NULL OR a.id IS NOT NULL)
  AND greatest(e.awakening_from,COALESCE(a.awakening_from,0)) < least(COALESCE(e.awakening_until,6),COALESCE(a.awakening_until,6))
), merged AS (
 SELECT id,character_id,skill_id,status_id,awakening_level,stat_code,target,value,unit,per_stack,condition,
 unnest(range_agg(availability)) AS availability FROM intervals
 GROUP BY id,character_id,skill_id,status_id,awakening_level,stat_code,target,value,unit,per_stack,condition
)
SELECT id,character_id,skill_id,status_id,awakening_level,stat_code,target,value,unit,per_stack,condition,
 lower(availability) AS awakening_from, nullif(upper(availability),6) AS awakening_until FROM merged;
CREATE INDEX character_status_lookup ON character_statuses(status_id,character_id);
CREATE INDEX status_application_lookup ON status_applications(status_id,character_id,target);
