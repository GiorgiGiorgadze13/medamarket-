# MedaMarket - Disaster Recovery & Backup Runbook

This document details the automated offsite backup architecture, configuration requirements, and step-by-step disaster recovery procedures for MedaMarket.

---

## 1. Automated Backup Architecture

- **Frequency:** Daily at 03:00 UTC (07:00 AM Georgia Time) via GitHub Actions (`.github/workflows/db-backup.yml`).
- **Engine:** PostgreSQL `pg_dump` with `--clean --if-exists --no-owner --no-privileges`.
- **Compression:** Gzip level 9 (`.sql.gz`).
- **Encryption:** OpenSSL AES-256-CBC with PBKDF2 key derivation (100,000 iterations). Raw SQL is never transmitted or stored unencrypted.
- **Storage Target:** S3-compatible object storage (Cloudflare R2 or AWS S3).
- **Retention Policy:**
  - **Daily:** Retains the 7 most recent daily snapshots in `s3://<bucket>/daily/`.
  - **Weekly:** Saves Sunday snapshots to `s3://<bucket>/weekly/` and retains 4 weekly snapshots (1 month of history).

---

## 2. Required GitHub Secrets Setup

To activate the automated workflow, add the following secrets in your GitHub repository:
**GitHub Repository -> Settings -> Secrets and variables -> Actions -> New repository secret**

| Secret Name | Description | Example |
| :--- | :--- | :--- |
| `BACKUP_DATABASE_URL` | Full Neon PostgreSQL connection string (or use `DATABASE_URL`) | `postgresql://user:pass@ep-xyz.eu-central-1.aws.neon.tech/neondb?sslmode=require` |
| `BACKUP_ENCRYPTION_KEY` | High-entropy secret passphrase for AES-256 encryption | Generate using `openssl rand -base64 32` |
| `S3_ENDPOINT` | Endpoint for S3-compatible storage (leave blank for AWS S3) | `https://<account-id>.r2.cloudflarestorage.com` (Cloudflare R2) |
| `S3_BUCKET_NAME` | Dedicated backup bucket name | `medamarket-backups` |
| `S3_ACCESS_KEY_ID` | Storage access key ID | `0123456789abcdef` |
| `S3_SECRET_ACCESS_KEY` | Storage secret access key | `abcdef0123456789...` |
| `S3_REGION` | Storage region (optional, defaults to `auto`) | `auto` (for R2) or `eu-central-1` (for S3) |

> [!IMPORTANT]
> All credentials are automatically masked in GitHub Actions execution logs to prevent leakage.

---

## 3. How to Trigger a Manual Backup

1. Go to your GitHub repository.
2. Click the **Actions** tab.
3. Select **MedaMarket Daily Database Backup & Encryption** from the left sidebar.
4. Click **Run workflow** -> **Run workflow**.
5. Once completed, download and verify the run logs.

---

## 4. Database Restoration Procedure (Disaster Recovery)

> [!CAUTION]
> NEVER test restoration against the live production database. Always verify backups against a dedicated staging, test, or local database instance.

### Prerequisites
- Node.js (v18+) or Bash shell with `openssl`, `gunzip`, and `psql` installed.
- Target staging database connection string.

### Method A: Using Node.js Script (Windows / macOS / Linux)

```bash
# 1. Download the encrypted backup from your storage bucket
# e.g. medamarket_20261113_030000.sql.gz.enc

# 2. Run the restoration tool
node scripts/restore-database.js \
  --backup ./medamarket_20261113_030000.sql.gz.enc \
  --target-url "postgresql://staging_user:staging_pass@ep-staging.eu-central-1.aws.neon.tech/staging_db?sslmode=require" \
  --key "YOUR_BACKUP_ENCRYPTION_KEY"
```

### Method B: Using Bash Script (Linux / macOS / Git Bash)

```bash
chmod +x ./scripts/restore-database.sh
./scripts/restore-database.sh \
  ./medamarket_20261113_030000.sql.gz.enc \
  "postgresql://staging_user:staging_pass@ep-staging.eu-central-1.aws.neon.tech/staging_db?sslmode=require" \
  "YOUR_BACKUP_ENCRYPTION_KEY"
```

---

## 5. Post-Restoration Data Verification

After restoring into your test database, run the following SQL queries to verify data integrity:

```sql
-- 1. Check total counts
SELECT count(*) AS total_products FROM "Product";
SELECT count(*) AS total_categories FROM "Category";
SELECT count(*) AS total_sales FROM "Sale";
SELECT count(*) AS total_sale_items FROM "SaleItem";
SELECT count(*) AS total_users FROM "User";

-- 2. Check the most recent sale
SELECT "receiptNumber", "totalAmount", "createdAt", "idempotencyKey"
FROM "Sale"
ORDER BY "createdAt" DESC
LIMIT 5;

-- 3. Verify foreign key integrity
SELECT s.id, s."receiptNumber", count(si.id) as item_count
FROM "Sale" s
LEFT JOIN "SaleItem" si ON si."saleId" = s.id
GROUP BY s.id, s."receiptNumber"
HAVING count(si.id) = 0;
```
