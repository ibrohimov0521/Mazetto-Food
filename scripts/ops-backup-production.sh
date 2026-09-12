#!/usr/bin/env bash
set -euo pipefail
umask 077

service="${MAZETTO_PG_SERVICE:-mazetto-food-mazettopostgres-ogwxuo}"
backup_dir="${MAZETTO_BACKUP_DIR:-/mnt/storage/backups/mazetto/postgres}"
container="$(docker ps --filter "label=com.docker.swarm.service.name=$service" --format '{{.ID}}')"

if [[ -z "$container" || "$container" == *$'\n'* ]]; then
  printf 'Expected one running PostgreSQL task for %s\n' "$service" >&2
  exit 1
fi

mkdir -p "$backup_dir"
cd "$(dirname "${BASH_SOURCE[0]}")/.."

MAZETTO_PG_CONTAINER="$container" \
MAZETTO_BACKUP_DIR="$backup_dir" \
  node scripts/ops-backup-db.mjs
