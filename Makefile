DB_CONTAINER := lune-postgres-1
DB_USER := lune
DB_NAME := lune_dev
SCHEMA_FILE := personal_finance_schema.sql

db-create:
	docker exec -i $(DB_CONTAINER) psql -U $(DB_USER) -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $(DB_NAME);" || true

db-drop:
	docker exec -i $(DB_CONTAINER) psql -U $(DB_USER) -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $(DB_NAME);"

db-migrate:
	docker exec -i $(DB_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME) -v ON_ERROR_STOP=1 < $(SCHEMA_FILE)

db-reset: db-drop db-create db-migrate