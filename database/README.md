# Character data

`make migrate` applies schema only. `make import` separately upserts local JSON files from
`database/data/`, which is ignored by Git and Docker builds. Never auto-import on server startup.

## Schema

```text
games → characters → skills (six main categories)
      → elements   → awakenings
      → classes    → statuses → status_rules
                   → effects (skill OR status)
                   → status_applications (skill → status + recipient)
```

`001_schema.sql` creates the current six-skill schema directly. No intermediate action tables
or screenshot metadata are created.

Each complete character has six skills: normal_attack, special, elemental, ultimate, support, passive.
A skill's bilingual description contains the complete text of its named moves in reading order.
For Mei, Blazing Sun and the two counter/rush sections are paragraphs inside Normal Attack.
`skills.has_hold` is only a boolean flag. Mei Normal Attack and Eliade Special Skill are marked true.
Possessing a resource (“holding Devotion”) is not button-hold input.

Buff/debuff labels are statuses, not separate skill slots. Numeric effects carry effect_type,
stat_code, target, value, unit, condition and awakening bounds. Applications record which skill
grants that status, how many stacks (NULL if unspecified), to whom, and under what conditions.

40 percent means 40%; 300 percent_of_stat means 3× the named character's stat.
HP healing, Max HP increase, skill damage and enemy damage taken remain separate effect types.
Awakening versions use [awakening_from, awakening_until), with NULL meaning no upper bound.
Never add a replaced A0 effect to its A2 replacement.

## Local JSON format v2

Files: `00-reference.json`, `helen.json`, `mei.json`, `eliade.json`.
New clones must supply these ignored data files separately.

```json
{
  "schemaVersion": 2,
  "tables": {
    "games": [
      { "id": "example", "name": { "en": "Example", "th": "ตัวอย่าง" } }
    ]
  }
}
```

Allowed tables are shown in the schema above. One character file includes that character and
its skills, awakenings, statuses, rules, effects and applications. Use stable IDs and en/th text.
An action condition can retain `section_name` as text to identify a particular paragraph;
that is not an extra skill or another table.

```sh
make migrate
make import
make import FILE=/app/database/data/mei.json
```

A single-character import requires shared lookup data to exist. All files are imported in one
transaction, in table dependency order. Primary keys are upserted. Omitted fields and rows are
preserved; explicit null clears a nullable field. Removing JSON rows does not delete DB rows.

## API and filtering

- `GET /api/characters/meta`: games, elements, classes and supported buff stats.
- `GET /api/characters?q=Mei&buff=atk&target=self&awakening=2`
- `GET /api/characters?buff=crit_dmg&target=all_allies`
- `GET /api/characters?hold=true`
- `GET /api/characters/mei?awakening=5`

Filters also support game, element, class, limit (1–100) and offset.
Stat buff filters require effect_type=stat_increase and an active acquisition route for the same
recipient, or a direct skill effect. Filter target matches the same effect as stat, not another
unrelated buff on the character. Eclipse has no direct acquisition route and is excluded from
ordinary buff filters; it appears in details as conditional conversion requiring both Sun and Moon.
All queries use parameters and active awakening intervals. Details include full skill text,
active numeric effects, acquisition descriptions, status rules and awakening descriptions.

## Tests

`make test` uses a separate PostgreSQL service with tmpfs storage and never DATABASE_URL.
Requires `make install` and the local JSON files above. It tests import reruns, six-skill shape,
hold flags, ATK self vs team, team CRIT DMG, Eclipse exclusion, awakening replacements,
Thai search, paging, invalid input and error responses. The test database container is removed afterward.
`make check` checks types; `make build` builds the web and API.

Unknown cooldowns, stack caps and scaling are kept unknown. Helen's Blessing is confirmed to grant Sun to all allies, equal to Devotion consumed.
Its stable ID remains helen-blessing, while code sun links it to other Sun providers. Displayed equipped stats are not character base stats.

## Explicit reset

`make reset-db` deletes application tables at `DATABASE_URL` and recreates the schema.
All drops and migrations run in one transaction; failure rolls back the reset.
It preserves unrelated tables and refuses to cascade into external dependencies.
No JSON is imported; run `make import` separately. Local files and Docker volumes are preserved.

Conditional effects expose `required_statuses` with providers discovered from same-game status
codes and active `status_applications`. Each provider includes character ID/name, skill text,
stack grant and recipient. The UI links to those character details. A self-only provider must
not be interpreted as granting its status to the character currently being viewed.

## Teams

`002_teams.sql` adds `teams`: `id`, `game_id`, `name`, `description`, and
`character_1_id`, `character_2_id`, `character_3_id`. All three characters are required,
distinct and belong to the team's game. Slot order is display order, not skill order.
Names and descriptions use en/th objects; description is free-form multiline text
(numbered steps, Markdown, or other notes), with no fixed number of steps.
An empty translation can fall back to English. These notes are user-authored, not verified mechanics.

Import a separate ignored file such as `database/data/team-light-dark.json` after the
characters exist, using `make import FILE=/app/database/data/team-light-dark.json`.
Use schemaVersion 2 with `tables.teams` rows, for example (replace the game ID):

```json
{
  "schemaVersion": 2,
  "tables": {
    "teams": [{
      "id": "helen-mei-eliade",
      "game_id": "<existing-game-id>",
      "name": {"en": "Light and Dark", "th": "ทีมแสงและมืด"},
      "character_1_id": "helen",
      "character_2_id": "mei",
      "character_3_id": "eliade",
      "description": {"en": "", "th": "1. เตรียมบัฟ\n2. สลับตัวละคร\n3. ทำดาเมจ"}
    }]
  }
}
```

Team browsing: `#/teams` lists teams; `#/teams/:id` shows their three linked members
and bilingual free-form notes. Notes render as escaped text preserving line breaks.
`GET /api/teams?limit=24&offset=0` returns items/total; `GET /api/teams/:id` returns
one team with member names in slot order (404 if absent).
The first local import file is `database/data/team-helen-mei-eliade.json`.
Run `make migrate`, then `make import FILE=/app/database/data/team-helen-mei-eliade.json`
after its characters have been imported.
