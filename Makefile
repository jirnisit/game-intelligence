.DEFAULT_GOAL := help
COMPOSE := docker compose

.PHONY: reset-db test help migrate import install up down restart build logs ps check shell db-shell
help:
	@echo "make reset-db Delete application data and recreate schema (DATABASE_URL)"
	@echo "make test     Run API/database tests in an isolated test database"
	@echo "make import   Import local JSON data (optional: FILE=/app/database/data/mei.json)"
	@echo "make migrate  Apply database schema migrations"
	@echo "make up       Start development services"
	@echo "make down     Stop containers (keep database)"
	@echo "make restart  Restart containers"
	@echo "make install  Install locked dependencies into Docker volumes"
	@echo "make build    Build the application in Docker"
	@echo "make logs     Follow logs (optional: SERVICE=gint-api)"
	@echo "make ps       Show service status"
	@echo "make check    Validate Compose and type-check in Docker"
	@echo "make shell    Open backend shell"
	@echo "make db-shell Open PostgreSQL console"

install:
	$(COMPOSE) run --rm --no-deps gint-web install --frozen-lockfile

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

build:
	$(COMPOSE) run --rm --no-deps gint-web build

logs:
	$(COMPOSE) logs -f --tail=100 $(SERVICE)

ps:
	$(COMPOSE) ps

check:
	$(COMPOSE) config --quiet
	$(COMPOSE) run --rm --no-deps gint-web check

shell:
	$(COMPOSE) exec gint-api sh

db-shell:
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

migrate:
	$(COMPOSE) run --rm --no-deps gint-api --filter @game-intelligence/server db:migrate

import:
	$(COMPOSE) run --rm --no-deps gint-api --filter @game-intelligence/server db:import $(if $(FILE),"$(FILE)")

test:
	@trap '$(COMPOSE) -f compose.yaml -f compose.test.yaml rm -sf test-db >/dev/null' EXIT; \
	$(COMPOSE) -f compose.yaml -f compose.test.yaml run --rm test

reset-db:
	$(COMPOSE) run --rm --no-deps gint-api --filter @game-intelligence/server db:reset
