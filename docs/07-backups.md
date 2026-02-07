# Backups

PharOS uses Postgres. Backups are `pg_dump`-based and write `.sql` files to `./backups/`.

## Prereqs

- `pg_dump` must be available on your `PATH`.
  - If you use Docker Desktop, install Postgres client tools locally, or run `pg_dump` via a container.
- `DATABASE_URL` must be set (see `.env`).

## Create A Backup

```bash
pnpm db:backup
```

Output path:

- `./backups/pharos-YYYYMMDD-HHMMSS.sql`

Optional env vars:

- `BACKUP_DIR=/absolute/or/relative/path`

