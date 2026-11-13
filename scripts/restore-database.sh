#!/usr/bin/env bash
# MedaMarket Disaster Recovery - Database Restoration Script (Bash)
set -eo pipefail

usage() {
  echo "================================================================="
  echo "MedaMarket Disaster Recovery Restoration Tool (Bash)"
  echo "================================================================="
  echo "Usage:"
  echo "  ./scripts/restore-database.sh <backup_file> <staging_database_url> <encryption_key> --confirm-staging"
  echo ""
  echo "Example:"
  echo "  ./scripts/restore-database.sh \\"
  echo "    ./backups/medamarket_20261113.sql.gz.enc \\"
  echo "    \"postgresql://user:pass@ep-staging.eu-central-1.aws.neon.tech/staging_db?sslmode=require\" \\"
  echo "    \"my-secret-passphrase\" \\"
  echo "    --confirm-staging"
  exit 1
}

BACKUP_FILE="$1"
TARGET_URL="$2"
ENC_KEY="${3:-$BACKUP_ENCRYPTION_KEY}"
CONFIRM_FLAG="$4"

if [ -z "$BACKUP_FILE" ] || [ -z "$TARGET_URL" ]; then
  usage
fi

if [ "$CONFIRM_FLAG" != "--confirm-staging" ]; then
  echo "[SAFETY BLOCK] Missing confirmation flag: --confirm-staging"
  echo "You must supply --confirm-staging as the 4th argument to confirm this is a test/staging database."
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Mask credentials for display
MASKED_URL=$(echo "$TARGET_URL" | sed -E 's/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/\1***\2/')

echo "================================================================="
echo "MedaMarket Disaster Recovery Restoration"
echo "================================================================="
echo "Target DB: $MASKED_URL"
echo "Backup:    $BACKUP_FILE"
echo "-----------------------------------------------------------------"

# Guard: Check if target equals production DATABASE_URL
if [ -n "$DATABASE_URL" ] && [ "$TARGET_URL" = "$DATABASE_URL" ]; then
  echo "[CRITICAL SAFETY BLOCK] Target URL matches production DATABASE_URL!"
  echo "Restoring directly into production is strictly blocked."
  exit 1
fi

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

CURRENT_FILE="$BACKUP_FILE"

# 1. Decrypt if .enc
if [[ "$CURRENT_FILE" == *.enc ]]; then
  if [ -z "$ENC_KEY" ]; then
    echo "Error: Backup file is encrypted (.enc) but no encryption key provided."
    exit 1
  fi
  echo "Decrypting AES-256 PBKDF2 encrypted archive..."
  DECRYPTED="$TEMP_DIR/dump.sql.gz"
  openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -in "$CURRENT_FILE" \
    -out "$DECRYPTED" \
    -pass pass:"$ENC_KEY"
  CURRENT_FILE="$DECRYPTED"
fi

# 2. Decompress if .gz
if [[ "$CURRENT_FILE" == *.gz ]]; then
  echo "Decompressing gzip archive..."
  DECOMPRESSED="$TEMP_DIR/dump.sql"
  gunzip -c "$CURRENT_FILE" > "$DECOMPRESSED"
  CURRENT_FILE="$DECOMPRESSED"
fi

# 3. Restore via psql
echo "Restoring to staging database with SSL mode enabled..."
export PGSSLMODE=require
psql "$TARGET_URL" -f "$CURRENT_FILE"

echo "================================================================="
echo "SUCCESS: Database restored cleanly from backup."
echo "================================================================="
