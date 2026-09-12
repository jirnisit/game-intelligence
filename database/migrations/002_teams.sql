-- Fixed three-character teams; slot order is display order, not a forced rotation.
ALTER TABLE characters ADD CONSTRAINT characters_game_id_id_key UNIQUE (game_id, id);

CREATE TABLE teams (
  id text PRIMARY KEY,
  game_id text NOT NULL REFERENCES games(id),
  name jsonb NOT NULL CHECK (
    jsonb_typeof(name) = 'object' AND name ?& ARRAY['en', 'th']
    AND jsonb_typeof(name->'en') = 'string' AND jsonb_typeof(name->'th') = 'string'
  ),
  description jsonb NOT NULL DEFAULT '{"en":"","th":""}' CHECK (
    jsonb_typeof(description) = 'object' AND description ?& ARRAY['en', 'th']
    AND jsonb_typeof(description->'en') = 'string' AND jsonb_typeof(description->'th') = 'string'
  ),
  character_1_id text NOT NULL,
  character_2_id text NOT NULL,
  character_3_id text NOT NULL,
  CHECK (character_1_id <> character_2_id AND character_1_id <> character_3_id AND character_2_id <> character_3_id),
  FOREIGN KEY (game_id, character_1_id) REFERENCES characters(game_id, id),
  FOREIGN KEY (game_id, character_2_id) REFERENCES characters(game_id, id),
  FOREIGN KEY (game_id, character_3_id) REFERENCES characters(game_id, id)
);
CREATE INDEX teams_game ON teams(game_id);
CREATE INDEX teams_character_1 ON teams(character_1_id);
CREATE INDEX teams_character_2 ON teams(character_2_id);
CREATE INDEX teams_character_3 ON teams(character_3_id);
