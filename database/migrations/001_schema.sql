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
  id text PRIMARY KEY, character_id text NOT NULL REFERENCES characters(id),
  code text NOT NULL, name jsonb NOT NULL,
  kind text NOT NULL CHECK (kind IN ('buff','debuff','resource','damage_trigger')),
  description jsonb NOT NULL,
  completeness text NOT NULL DEFAULT 'partial' CHECK (completeness IN ('partial','documented')),
  UNIQUE(character_id, code), UNIQUE(character_id, id)
);
-- Each interval describes a replacement, not an additive awakening bonus.
CREATE TABLE status_rules (
  id text PRIMARY KEY, character_id text NOT NULL, status_id text NOT NULL,
  awakening_from integer NOT NULL DEFAULT 0 CHECK (awakening_from BETWEEN 0 AND 5),
  awakening_until integer CHECK (awakening_until BETWEEN 1 AND 6 AND awakening_until > awakening_from),
  max_stacks integer CHECK (max_stacks > 0),
  duration_seconds numeric CHECK (duration_seconds >= 0),
  duration_kind text NOT NULL CHECK (duration_kind IN ('timed','unlimited','unknown')),
  refresh_on_stack boolean, mechanics jsonb NOT NULL DEFAULT '{}',
  CHECK ((duration_kind = 'timed' AND duration_seconds IS NOT NULL) OR (duration_kind <> 'timed' AND duration_seconds IS NULL)),
  UNIQUE(status_id, awakening_from),
  FOREIGN KEY(character_id, status_id) REFERENCES statuses(character_id, id)
);
CREATE TABLE effects (
  id text PRIMARY KEY, character_id text NOT NULL REFERENCES characters(id),
  skill_id text, status_id text,
  effect_type text NOT NULL CHECK (effect_type IN ('stat_increase','damage_taken_increase','break_damage_taken_increase','heal','skill_damage_increase','damage','immunity','cooldown_reduction','gauge_recovery')),
  stat_code text CHECK (stat_code IN ('atk','def','hp','max_hp','crit_rate','crit_dmg','dmg_bonus','elemental_dmg','break_gauge','ultimate_gauge','rift_gauge','cooldown','stagger','down')),
  target text NOT NULL CHECK (target IN ('self','all_allies','enemy','unknown')),
  value numeric, unit text CHECK (unit IN ('percent','flat','seconds','percent_of_stat')),
  scaling_stat text, scaling_character_id text REFERENCES characters(id), element_code text,
  per_stack boolean NOT NULL DEFAULT false,
  awakening_from integer NOT NULL DEFAULT 0 CHECK (awakening_from BETWEEN 0 AND 5),
  awakening_until integer CHECK (awakening_until BETWEEN 1 AND 6 AND awakening_until > awakening_from),
  condition jsonb NOT NULL DEFAULT '{}', description jsonb NOT NULL,
  CHECK (num_nonnulls(skill_id, status_id) = 1),
  CHECK ((value IS NULL) = (unit IS NULL)),
  FOREIGN KEY(character_id, skill_id) REFERENCES skills(character_id, id),
  FOREIGN KEY(character_id, status_id) REFERENCES statuses(character_id, id)
);
CREATE INDEX effects_filter ON effects(effect_type, stat_code, target, character_id, awakening_from);
-- A documented route that grants a status. Merely having a tooltip is not a route.
CREATE TABLE status_applications (
  id text PRIMARY KEY, character_id text NOT NULL, skill_id text NOT NULL, status_id text NOT NULL,
  target text NOT NULL CHECK (target IN ('self','all_allies','enemy','unknown')),
  stacks integer CHECK (stacks > 0), condition jsonb NOT NULL DEFAULT '{}',
  awakening_from integer NOT NULL DEFAULT 0 CHECK (awakening_from BETWEEN 0 AND 5),
  awakening_until integer CHECK (awakening_until BETWEEN 1 AND 6 AND awakening_until > awakening_from),
  FOREIGN KEY(character_id, skill_id) REFERENCES skills(character_id, id),
  FOREIGN KEY(character_id, status_id) REFERENCES statuses(character_id, id)
);
