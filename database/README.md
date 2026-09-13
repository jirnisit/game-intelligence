# Character data

`make migrate` applies schema only. `make import` separately upserts local JSON files from
`database/data/`, which is ignored by Git and Docker builds. Never auto-import on server startup.

## Schema

```text
games → characters → skills → skill_elements
      → statuses → effects / status_rules
      → elemental_reactions → reaction_pairs
characters + statuses → character_statuses
skills + statuses → status_applications
```

`statuses` is a game-wide catalogue with one row per `(game_id, code)`, with no character owner.
Buffs, debuffs, resources and damage triggers share this table. A status ID may retain a historical
character prefix; it does not imply ownership. In particular, the canonical Sun ID remains
`helen-blessing`. Resonance has one definition used by Luni, Autrey and Erka.

`character_statuses` associates a character with a status and recipient (`self`, `all_allies`,
`enemy`, `unknown`). This is a usage/dependency link, not evidence that the character grants it.
`status_applications` is the evidence: a skill, recipient, stacks, conditions and awakening interval.
Erka references Resonance but has no application of it; provider discovery follows applications.

Common status `effects` and `status_rules` have `character_id: null`. Their definitions are stored
once. In a character context, common effect recipients are resolved from `character_statuses`.
Character-specific variants may use `character_id`, with complete non-overlapping awakening
intervals. Do not combine a global rule with an overlapping character rule. Skill effects always
have `character_id` and a skill owned by that character. Each effect has exactly one source: skill, status, or `awakening_level`. Independent awakening effects reference `(character_id, awakening_level)` and require no fake skill or status.
Foreign keys and triggers enforce skill ownership and same-game links.

The `character_effects` / `character_status_rules` views resolve shared definitions. `character_buffs`
intersects effect and acquisition intervals, merging overlapping acquisition routes so one buff
is not counted twice. All percentages use percentage points: 40 is 40%; 300 percent_of_stat is 3×.
Replacement intervals are half-open: `[awakening_from, awakening_until)`, with null as unbounded.
Unknown values stay null and have null units; unknown durations use `duration_kind: "unknown"`.

Each complete character has exactly six skills: normal_attack, special, elemental, ultimate,
support, passive. Keep every named move in that category's single bilingual description.
`has_hold` means holding a button, never possessing gauge/stacks. Currently Mei Normal Attack,
Eliade Special Skill and Autrey Special Skill have documented button holds.

## Local JSON format v2

Files: `00-reference.json` for lookups, `01-statuses.json` for shared statuses and reactions,
and one character file each (`helen.json`, `mei.json`, `eliade.json`, `luni.json`, `autrey.json`, `erka.json`).
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

Allowed tables are shown in the schema above. One character file includes that character, skills, skill_elements, awakenings, character_statuses,
character-specific rules/effects and applications. Shared status definitions belong in `01-statuses.json`. Use stable IDs and en/th text.
An action condition can retain `section_name` as text to identify a particular paragraph;
that is not an extra skill or another table.

```sh
make migrate
make import
make import FILE=/app/database/data/mei.json
make import FILE=./characters/groupB
make import FILE=./characters/groupB/mei
```

`FILE` accepts a JSON file or a directory. Directories are scanned recursively for `.json`
files in sorted path order; other files and nested symlinks are ignored. Relative paths passed
to `make import` start at the project root; absolute paths refer to paths inside the container
(the project is mounted at `/app`). Without `FILE`, the default remains `database/data/`.
An empty directory tree fails before connecting to the database. Keep only import-format JSON
within the selected tree; every JSON file must pass the existing schemaVersion 2 validation.

A single-character import requires both shared lookup and status data to exist. All files are imported in one
transaction, in table dependency order. Primary keys are upserted. Omitted fields and rows are
preserved; explicit null clears a nullable field. Removing JSON rows does not delete DB rows.

## API and filtering

- `GET /api/characters/meta`: games, elements, classes, buff stats and reaction pairs.
- `GET /api/characters?buff=atk`: searches every awakening level by default, including A2/A5-only buffs.
- `GET /api/characters?buff=atk&awakening=0`: explicitly restricts analysis to active base effects.
- `GET /api/characters?buff=crit_dmg&target=all_allies`: only documented team grants.
- `GET /api/characters?game=limit-zero-breakers&reaction_with=earth`: documented Grass-applying skills.
- `GET /api/characters/:id?awakening=2`: `effects` contains only the active analysis values;
  `effect_variants` includes all levels for comparison. Each status has active `rule` plus all `rules`.
- `GET /api/reactions?game=limit-zero-breakers`: shared reaction effects, pairs and unknown mechanics.

The UI shows Base, Awakening 2 and Awakening 5 values together on cards and details. It does not
filter away awakening-only abilities. Labels use the intersection of effect and application
availability; a base status granted only at A2 is labelled A2. Alternative grant routes are merged.
Recipients and effect types remain distinct. A tooltip/dependency alone is not a searchable grant.
Conditional Eclipse remains excluded from direct stat-buff searches. Required status providers
include their recipient and awakening interval, including same-game cross-character providers.

`skill_elements` documents which skill actually applies an element. `reaction_pairs` stores one
unordered pair (`element_a < element_b`) and search works in either direction. Fire–Water,
Lightning–Wind, Grass–Earth and Light–Dark are the documented pairs. The user confirmed the
sequence: A uses an Elemental Skill, then switching to B of the paired element causes B to
receive the Reaction. B does not need to cast an Elemental Skill. `paired_consecutive` refers
to this skill-then-switch sequence, not two skill casts. Team membership alone is insufficient.
Use “ถ้าเกิด Reaction” in explanations. Individual resource rewards retain their documented
conditions; do not tie receiving the Reaction to a second Elemental Skill cast. The time window,
Fusion effect values/duration, and Intensity trigger sequence are unknown. Intensity's known
resistance reduction is normalized as `stat_decrease / elemental_res` with a null value.
These records replace the former `elemental-reactions.md`; game rules are imported, not prose-only.

## Tests

`make test` uses a separate PostgreSQL service with tmpfs storage and never DATABASE_URL.
Requires `make install` and the six character files plus shared files above. It tests import reruns, six-skill shape,
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

## Consolidated development schema

The initial migration was edited at the user's request before deployment. This does not upgrade
an existing database that has the previous checksum. The runner still rejects modified applied
migrations; it never silently resets data or bypasses checksums. A reset of an existing development
database requires an explicit user request, followed by a separate import. No live reset/import is
part of the code/data restructuring. The local JSON format remains schemaVersion 2, but old
character-owned status files must be converted to the shared layout before import.

Erka A2 independently increases damage against enemies in Break by 100%; it does not require
Erka’s Awakening state. Passive effects retain their own Awakening-state conditions. Do not
store a combined 200% Passive value or treat A2 as a replacement of that Passive.
