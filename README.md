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
