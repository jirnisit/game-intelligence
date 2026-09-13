# Game Intelligence — database and analysis

## Project and commands
- Vue SPA, Fastify, PostgreSQL; pnpm workspace. Keep user-defined Compose networks and container names.
- `make install`, `make up`, `make check`; `make migrate` applies schema only to `DATABASE_URL`; `make import` separately loads local JSON data.
- Never print `.env`, connection URIs or credentials. Do not migrate a remote database merely to test a change; use an isolated test database.
- Do not commit or push unless requested. Do not infer deployment authorization from migration implementation work.

## Vue architecture
- Use Vue TSX (not `.vue`) with a feature-first structure: `src/app/`, `src/core/`, `src/features/`, `src/shared/`, and `src/main.ts`.
- Always declare a local `interface Props` for every component and use the function overload `defineComponent<Props>((props) => { return () => (...) }, { props: ['propName', 'onChange'] })`; do not inline the props type in the function parameter. Declare every typed prop, including callbacks, in the runtime `props` list. Components without props still declare `interface Props {}` and use `defineComponent<Props>(() => { ... })`; do not use an options object with `setup()`.
- Use typed callback props such as `onAwakeningChange: (value: number) => void` for child-to-parent communication. Call `props.onAwakeningChange(value)` directly; do not use `emits`, `emit()`, or `update:*` component events.
- Define features by capability, such as `home`, `character`, and `teams`; a game slug such as `limit-zero-breakers` is data, not a feature.
- Keep list and detail routes on separate page components (e.g. `character/pages/CharactersPage.tsx` and `character/pages/CharacterPage.tsx`). Extract independently reusable UI such as `character/components/CharacterCard.tsx`; pages own fetching and route state, while cards receive typed props.
- Each feature owns its `components/`, `pages/`, `stores/`, `services/`, and `types/` as needed. Use `types/`, not `models/`; keep feature-specific code out of global component, page, service, and store folders.
- Define all routes in `apps/web/src/app/router/index.ts`; do not create feature route files. `app/` also owns the app shell, layouts, providers, and global fallback pages.
- Scope game pages through `/game/:game/characters` and `/game/:game/teams`, with detail IDs appended. Read the game from route params for requests and navigation; do not hardcode a game in feature code.
- `core/` owns infrastructure and global foundations: API client, config, utilities, and shared types. `shared/` is only for components, composables, and assets reused across multiple features.
- Remove class names that have no styling purpose. Use `t-data="descriptive-name"` for test selectors rather than placeholder classes or `data-testid`; tests must not depend on utility class names. Keep classes only when they are Tailwind utilities or have an actual styling consumer.
- Style TSX with Tailwind utilities. Do not create feature stylesheets or collect feature selectors in global CSS; keep global CSS limited to Tailwind setup, base defaults, and design tokens.
- Use Material 3 typography tokens for Display, Headline, Title, Body, and Label, each with `s`, `m`, `l` and emphasized variants (e.g. `text-display-l`, `text-display-l-emphasized`). Define font size, line height, tracking, and weight together in `app/styles/typography.css`; prefer these tokens over ad hoc text sizes.

## Color architecture
- Use the hybrid primitive → semantic → component color system by default. `app/styles/palette.css` defines primary, secondary, tertiary, neutral, and error scales at 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, and 950.
- Raw `--palette-*` variables are for token mapping only. Do not use primitive shades, literal colors, or Tailwind's default palette in UI components without a documented, specific exception.
- `app/styles/colors.css` maps Material 3 semantic roles to primitives for light and dark themes and exposes Tailwind utilities. Components use roles such as `bg-surface-container`, `text-on-surface`, `bg-primary`, and `text-on-primary`; they must not select shades or branch colors by theme.
- Use `on-surface` for normal text and `on-surface-variant` for supporting text and hints. Pair colored containers with their `on-*` roles. Typography tokens control size, line height, tracking, and weight only; small text does not imply muted color.
- Keep interaction states separate in `app/styles/states.css`: use state layers/opacity for hover and pressed, visible semantic focus outlines, and disabled opacity/behavior. Do not create role variants such as `primary-hover` or `primary-pressed` without a concrete need.
- Preserve semantic role contrast in both themes when changing mappings. Theme preference belongs to app infrastructure; components consume the same semantic utilities in every theme.

## UI verification
- Do not capture the screen or take screenshots to verify UI unless the user explicitly requests visual inspection.
- Verify UI using code review, DOM inspection and relevant tests. Avoid tools that automatically capture screenshots during these checks.
- User-supplied images may still be read to fulfill the user's request, including extracting game data.

## Database model
- See `database/README.md` and `database/migrations/001_schema.sql`.
- `characters` references per-game `elements` and `character_classes`.
- Each complete character has six `skills` categories. Unique category per character is enforced; the six-category completeness rule is verified by data checks so drafts may remain incomplete.
- Store exactly six main skill categories for complete characters: Normal Attack, Special Skill, Elemental Skill, Ultimate, Support Skill and Passive Skill.
- Each skill has one bilingual description containing all its named moves/paragraphs. Do not create separate action records.
- `skills.has_hold` is true if any part of that skill requires a held button. It is only a marker, not a separate skill.
- Confirmed hold skills: `mei-normal_attack` (Blazing Sun paragraph) and `eliade-special` (Luminance Drain).
- “While holding Devotion/Darkness/Rift Gauge” means possessing a resource, NOT holding a button. Preserve this distinction.
- `statuses` describe buffs, debuffs, resources and triggered damage. `status_applications` record the main skill, documented acquisition route and target.
- `effects` are the filterable numeric effects; `status_rules` carry stack/duration mechanics. Mechanics/conditions JSON supplements normalized columns; do not move filterable stats into prose only.
- Do not store screenshot sources, filenames, or source_id. Read supplied images carefully and encode actual buff/debuff effects and recipients. Preserve unknowns rather than inventing values.

## Analysis rules
- Filter candidates by game/class/element and effects first; load descriptions for selected characters only.
- Use target and effect_type as well as stat_code. Team CRIT DMG, self CRIT DMG, HP healing, Max HP increase, damage taken and skill-only damage are different effects.
- All percentages use displayed percentage points: 40 = 40%, 300 percent_of_stat = 3 × the source stat. Do not treat 300 as 300×.
- Awakening intervals are half-open: `awakening_from <= level AND (awakening_until IS NULL OR level < awakening_until)`. Select exactly one version of a mechanic; never add replacement values together.
- Status effects may require an acquisition route. A tooltip alone does not prove a character grants that buff, especially to the team.
- Moon + Sun consume one stack each to create Lunar Eclipse. Helen supplies Sun (called Blessing in Penalty) to all allies, equal to Devotion consumed; Mei supplies Sun to herself; Eliade supplies Moon to all allies. Eclipse is conditional, not a free standalone buff.
- Do not count Sun/Moon stacks consumed in conversion as still present. Do not assume all maxima coexist or add Eclipse twice when analyzing a team.
- Collapse is a damage trigger at max stacks, not ATK increase. A5 replaces 10 stacks / 300% with 5 / 400%, then clears all stacks. Overflow behavior is undocumented.
- Unknown value, duration, stack cap or acquisition count stays NULL / unknown, never zero. Resource caps remain incomplete. Helen’s Blessing is confirmed by the user to be Sun (1.5% CRIT Rate per stack, max 5, 15 seconds). Keep the existing helen-blessing ID stable, but use canonical code sun for cross-character links.
- Mei's hold drain versus passive drain relationship is unknown; do not assert they add or replace without evidence.
- Character screen stats include level/equipment; do not use them as base stats.
- Source screenshots show current skill levels and may reflect awakenings. Preserve apparent differences; do not silently invent scaling tables.

## Teams
- `teams` stores a bilingual name and free-form bilingual description, plus exactly three distinct character IDs from the same game.
- Slot order is display order, not a forced combat rotation. Descriptions may contain numbered steps, Markdown or other notes; do not enforce five steps or interpret prose as verified mechanics.
- Team JSON files belong in the ignored `database/data/` directory and import separately through `make import`, after characters.

## Local data imports
- Data lives in `database/data/`, ignored by Git and Docker build context. Never force-add it. Keep schema, importer and format documentation tracked.
- Keep one JSON file per character plus `00-reference.json` for shared lookup rows. Use schemaVersion 2 and table arrays as documented.
- Import uses parameterized upserts in dependency order, with one transaction for the whole input. Reuse stable primary keys when editing; do not regenerate IDs.
- Missing rows/fields are not deleted or reset. Explicit null clears a nullable value. Deletion needs a separate deliberate operation.
- Do not run import automatically during migration or server startup. Do not claim a live DB update unless import succeeded there.

## Languages and migrations
- Human-readable fields use JSON objects with `en` and `th`; English is source-derived, Thai is a provisional translation. Codes/IDs are stable English identifiers.
- Fall back to English if a future Thai translation is absent. Never use a translated label as a filter key.
- The initial schema is consolidated in `001_schema.sql` at the user’s request. Uncommitted initial migrations may be consolidated when explicitly requested; otherwise applied migrations are immutable and changes need new numbered files. The runner checks SHA-256 and uses a transaction per file plus an advisory lock.
- `make reset-db` is an explicit destructive command: deletes application tables and recreates schema in one transaction, without importing JSON. Run only when the user requests an actual reset; never for routine verification.
- No automatic DROP/reset/down migration. Test upgrades on a clean isolated PostgreSQL database and verify reruns and rollback on failure.
- Keep FK ownership intact: skills, statuses and effects must belong to the same character. Validate non-overlapping awakening intervals when inserting new versions.
- Do not claim data is saved in a running database unless migration actually succeeded there.
