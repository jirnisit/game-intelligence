# Game Intelligence

โครงระบบวิเคราะห์ข้อมูลเกม: pnpm workspace, Vue 3 + Tailwind, Node/Fastify และ PostgreSQL

## Development ผ่าน Docker Compose

ต้องมี Docker ที่เปิดอยู่, Docker Compose และ Make
เตรียม `.env` จาก `.env.example` และตั้ง `POSTGRES_PASSWORD` ก่อนรัน

```sh
cp .env.example .env
# แก้ POSTGRES_PASSWORD ใน .env
make install
make up
```

ใช้ external network `game-intelligence-network` ตามที่กำหนดใน Compose
network ต้องมีอยู่แล้ว และ nginx หลักต้องเชื่อม network เดียวกัน
ไม่มีการ publish พอร์ตบน host; ให้ nginx หลักส่งต่อไป `gint-nginx:80`

```text
nginx หลัก → gint-nginx:80 → /      → gint-web:5173 (Vite dev + HMR)
                          → /api/ → gint-api:3000 (tsx watch) → db:5432
```

- `gint-web` รัน `pnpm --filter @game-intelligence/web dev`
- `gint-api` รัน `pnpm --filter @game-intelligence/server dev`
- mount source จากเครื่องเข้า container เพื่อให้แก้ Vue/CSS และ API แล้ว reload ได้
- dev services ใช้ `node:24.15.0-alpine` โดยตรง ไม่ build image
- `make install` ใช้ Corepack เลือก pnpm ตาม `packageManager` และติดตั้งตาม lockfile
- mount repository เข้า `/app` และใช้ named volumes สำหรับ node_modules ที่ root, web และ API แยกจาก host
- web และ API ใช้ dependency volumes ชุดเดียวกัน จึงติดตั้ง workspace ครั้งเดียว
- หลังเปลี่ยน dependencies ให้ปรับ lockfile ให้ตรง แล้วรัน `make install` และ `make restart`
- คำสั่ง install ใช้ `--frozen-lockfile` จึงแจ้ง error หาก package.json กับ lockfile ไม่ตรงกัน
- `gint-nginx` mount `docker/nginx.conf` แบบ read-only และรองรับ WebSocket สำหรับ Vite HMR
- `db` อยู่ใน default network ร่วมกับ API และเก็บข้อมูลใน named volume
- Compose นี้ใช้สำหรับ development; Dockerfile ยังมี production build/runtime stages ไว้ต่อยอด

| คำสั่ง | การทำงาน |
| --- | --- |
| `make install` | ติดตั้ง dependencies ลง Docker volumes ตาม lockfile |
| `make up` | เปิด dev services |
| `make down` | ปิดระบบโดยเก็บฐานข้อมูลไว้ |
| `make restart` | Restart containers เดิม |
| `make build` | Build application ผ่าน Node container |
| `make logs SERVICE=gint-web` | ดู log ของ Vite |
| `make logs SERVICE=gint-api` | ดู log ของ API |
| `make logs SERVICE=gint-nginx` | ดู log ของ nginx |
| `make ps` | ดูสถานะ |
| `make check` | ตรวจ Compose และ TypeScript ผ่าน Node container |
| `make shell` | เปิด shell ใน API |
| `make db-shell` | เปิด PostgreSQL console |

## nginx หลัก

ตัวอย่างส่วนที่ต้องใส่ใน config ของ nginx หลัก โดยปรับ server block ให้ตรงโดเมน:

```nginx
# http context
map $http_upgrade $gint_connection_upgrade {
    default upgrade;
    '' close;
}

upstream gint_development {
    server gint-nginx:80;
}

# ภายใน server block
location / {
    proxy_pass http://gint_development;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $gint_connection_upgrade;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
}
```

ไม่มี healthcheck; `make up` เริ่ม containers แต่ไม่ได้รอให้แอปหรือฐานข้อมูลพร้อม
ช่วงเริ่มต้น nginx อาจตอบ 502 ชั่วคราวจน Vite และ API เปิดครบ

ต้องส่งต่อ WebSocket ทั้งสองชั้นเพื่อให้ HMR ทำงานผ่านโดเมนได้
เปิด services ก่อนตรวจและ reload nginx หลักเพื่อให้ resolve upstream ได้
หลัง recreate container ที่เป็น upstream ให้ reload nginx ชั้นที่เรียกใช้งานเพื่อ resolve IP ใหม่

หลังแก้ `docker/nginx.conf` ตรวจและ reload โดยไม่ต้อง build:

```sh
docker compose exec gint-nginx nginx -t
docker compose exec gint-nginx nginx -s reload
```

## ตรวจโค้ดบนเครื่อง

ใช้ Node.js 24 และ pnpm 11.19.0

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

Vite config ตั้ง API proxy ไป `gint-api:3000` สำหรับ Docker network
หากรัน Vite และ API บน host โดยตรง ให้ปรับ proxy target ตามที่อยู่ API ของคุณ

ยังไม่มี CRUD ตัวละคร, schema เกม, login หรือ MCP tools
`.env` ไม่เข้า Git และ backend รับค่า environment จาก Compose
`make down` ไม่ลบข้อมูลหรือ dependencies; `docker compose down -v` จะลบทั้งฐานข้อมูลและ dependency volumes
การแก้ password ใน `.env` ไม่เปลี่ยน password ของฐานข้อมูลที่สร้างไปแล้ว

## เปลี่ยนฐานข้อมูลที่ API เชื่อมต่อ

API รับ connection URI ผ่าน `DATABASE_URL` ใน `.env`:

```dotenv
DATABASE_URL=postgresql://user:password@database-host:5432/database_name
```

ค่าเริ่มต้นใน `.env.example` อ้าง credentials ของ service `db`
หากลองฐานข้อมูลบน server ให้เปลี่ยน host, credentials และชื่อ database ใน URI
ถ้า username/password มีอักขระพิเศษ เช่น @, : หรือ / ให้ URL-encode ก่อนใส่ URI
ตั้งค่า SSL ตามที่ผู้ให้บริการฐานข้อมูลกำหนดใน connection URI
หลังแก้ให้เรียก `make up` เพื่อ recreate API ด้วย environment ใหม่
Compose ยังเปิดฐานข้อมูล local ตามเดิม แต่ API จะเชื่อมเฉพาะปลายทางใน URI
หากต้องการเปิดเฉพาะ API โดยไม่เริ่ม db local ใช้ `docker compose up -d --no-deps gint-api`

## ฐานข้อมูลตัวละคร

รองรับ JSON ตัวละคร Helen, Mei, Eliade, Luni, Autrey และ Erka พร้อมสถานะกลาง รองรับไทย/อังกฤษ,
สกิลย่อยที่ต้องกดค้าง, บัฟสำหรับ filter และผลทดแทนตาม Awakening
ใช้ `make migrate` สำหรับโครงสร้าง และ `make import` สำหรับข้อมูล JSON แยกกัน
ข้อมูลอยู่ใน `database/data/` ซึ่ง Git ignore ไว้
อ่านโครงสร้างและตัวอย่าง query ที่ [database/README.md](database/README.md)

## หน้าตัวละคร

เว็บแสดงรายชื่อและรายละเอียด 6 สกิลหลัก พร้อมสลับภาษาและแสดงค่าปกติ/Awakening คู่กัน
ค้นหาบัฟรวมทุกระดับ Awakening และค้นหาคู่ Fusion จากธาตุที่สกิลติดได้จริง
กรอง ATK/DEF/CRIT และบัฟอื่นได้ โดยแยกผู้รับเป็นตัวเองหรือทั้งทีม
บัฟที่ต้องผสมสถานะ เช่น Lunar Eclipse จะแสดงเงื่อนไขในรายละเอียด
ใช้ `make test` เพื่อทดสอบ API/filter กับฐานข้อมูลชั่วคราวแยกจากระบบจริง

## Reset ฐานข้อมูล

`make reset-db` ลบข้อมูลในตารางของแอปตาม `DATABASE_URL` แล้วสร้าง schema ใหม่
ไม่มีการ import อัตโนมัติ หากต้องการข้อมูลกลับมาให้รัน `make import` แยก
ไฟล์ JSON และ node_modules volumes ไม่ถูกลบ

## Kab Game frontend

ชื่อโปรเจกต์คือ `game-intelligence`; ชื่อเว็บคือ **Kab Game** ใช้ Vue Router, TSX และ Tailwind

- `/` — Home แสดงรายการเกมจาก `apps/web/src/core/config/games.ts` โดยไม่เรียก API
- `/game/:game/characters` และ `/game/:game/characters/:characterId` — ตัวละครและรายละเอียด
- `/game/:game/teams` และ `/game/:game/teams/:teamId` — ทีมและรายละเอียด
- ตัวอย่าง: `/game/limit-zero-breakers/characters`; `:game` เป็น route parameter ที่ใช้กรองข้อมูล

```text
apps/web/src/
├── app/
│   ├── layouts/            # Layout ระดับแอปสำหรับหน้าเกม
│   ├── pages/              # 404
│   ├── providers/
│   ├── router/index.ts     # รวม route definitions ไว้ที่เดียว
│   └── styles/             # Tailwind setup, base defaults, typography tokens
├── core/
│   ├── api/
│   ├── config/             # รายการเกมและภาษา
│   └── types/
├── features/
│   ├── home/pages/
│   ├── character/          # pages/CharactersPage, pages/CharacterPage, components/CharacterCard, services/, types/
│   └── teams/              # pages/, services/, types/
├── shared/composables/     # useLanguage, useGame
└── main.ts
```

Feature แบ่งตามความสามารถ ไม่แบ่งตามชื่อเกม แต่ละ feature เก็บ components/stores เพิ่มเมื่อจำเป็น
ใช้ `types/` แทน `models/` และไม่สร้าง routes หรือ stylesheets ใน feature
ใช้ Tailwind utilities ใน TSX; CSS กลางมีเฉพาะ base defaults และ design tokens

### Typography

Material 3 มี Display, Headline, Title, Body, Label แต่ละกลุ่มมี `s`, `m`, `l` และ `-emphasized` รวม 30 tokens
ตัวอย่าง: `text-display-l`, `text-headline-m-emphasized`, `text-title-s`, `text-body-l`, `text-label-m-emphasized`
ใช้ responsive variants ได้ เช่น `text-headline-l md:text-display-s`
กำหนด size, line-height, letter-spacing และ weight ร่วมกันที่ `app/styles/typography.css` โดยใช้ font stack ของแอป
อ้างอิง metrics จาก [Material 3 AndroidX tokens](https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/TypeScaleTokens.kt) และ [Tailwind theme typography](https://tailwindcss.com/docs/font-size#customizing-your-theme)

ไฟล์ logo และ favicon อยู่ใน `apps/web/public/` และเรียกผ่าน `/ชื่อไฟล์`
Vite รองรับ URL ย่อยโดยตรง; static hosting ต้องตั้ง SPA fallback เป็น `index.html`
ตรวจ DOM/navigation โดยไม่ถ่ายภาพหน้าจอ: `docker compose run --rm --no-deps gint-web --filter @game-intelligence/web test`

### Color system

`app/styles/palette.css` → `app/styles/colors.css` → semantic Tailwind utilities in TSX.
The five primitive palettes (primary/secondary/tertiary/neutral/error) each have shades 50–950.
Raw `--palette-primary-500` variables are deliberately not exposed as Tailwind color utilities.
Use `bg-primary text-on-primary` for a primary action, `bg-surface-container text-on-surface` for a card, and `text-on-surface-variant` for a hint.
Choose typography separately, for example `text-body-s text-on-surface` for small normal text.

The header theme control offers System, Light, and Dark and saves the preference locally. Semantic roles switch through `data-theme` on the document element; new components need no theme-specific shades.
`states.css` defines independent hover/focus/pressed/disabled opacity values and the `state-layer` utility; use it for custom interactive surfaces. Buttons receive it from base defaults. Disabled custom controls must also block interaction or use native disabled controls; opacity alone does not disable behavior.
Typography, palette, role mapping, and interaction state each have their own file.
