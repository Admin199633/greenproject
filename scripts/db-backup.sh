#!/usr/bin/env bash
# db-backup.sh — create a timestamped PostgreSQL dump.
#
# Usage:
#   ./scripts/db-backup.sh
#
# Requirements:
#   - pg_dump must be on PATH (ships with PostgreSQL client tools)
#   - The following env vars must be set (or sourced from .env):
#       POSTGRES_HOST     (default: localhost)
#       POSTGRES_PORT     (default: 5432)
#       POSTGRES_USER     (default: postgres)
#       POSTGRES_PASSWORD
#       POSTGRES_DB       (default: green_db)
#   - The backup directory defaults to ./backups (created if absent)
#
# Example cron (daily at 03:00):
#   0 3 * * * /path/to/project/scripts/db-backup.sh >> /var/log/green-backup.log 2>&1
#
# ── Retention policy ─────────────────────────────────────────────────────────
# Financial documents are subject to a 7-year mandatory retention period under
# Israeli accounting regulations.
#
# This script keeps the last 30 local dumps (≈ 1 month) for fast operational
# recovery.  For long-term compliance you MUST additionally archive dumps to
# off-site storage (e.g. S3 Glacier) and retain at least one full monthly dump
# per year for 7 years.  See README.md → "Data Retention Policy" for details.

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Source .env if present (ignores missing file, never fails)
if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
fi

PG_HOST="${POSTGRES_HOST:-localhost}"
PG_PORT="${POSTGRES_PORT:-5432}"
PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-green_db}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"

# ── Destination ───────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="$BACKUP_DIR/${PG_DB}_${TIMESTAMP}.sql.gz"

# ── Dump ──────────────────────────────────────────────────────────────────────
echo "[$(date -Iseconds)] Starting backup: $DUMP_FILE"

PGPASSWORD="${POSTGRES_PASSWORD:-}" \
  pg_dump \
    -h "$PG_HOST" \
    -p "$PG_PORT" \
    -U "$PG_USER" \
    -d "$PG_DB" \
    --no-owner \
    --no-acl \
    -F plain \
  | gzip > "$DUMP_FILE"

echo "[$(date -Iseconds)] Backup complete: $DUMP_FILE ($(du -sh "$DUMP_FILE" | cut -f1))"

# ── Retention: keep last 30 dumps ─────────────────────────────────────────────
find "$BACKUP_DIR" -maxdepth 1 -name "${PG_DB}_*.sql.gz" \
  | sort -r \
  | tail -n +31 \
  | xargs -r rm --
echo "[$(date -Iseconds)] Retention: kept last 30 dumps."
