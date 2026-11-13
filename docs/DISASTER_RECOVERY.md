# MedaMarket - Disaster Recovery & Backup Runbook

This document details the automated offsite backup architecture, configuration requirements, and step-by-step disaster recovery procedures for MedaMarket.

---

## 1. Automated Backup Architecture

- **Frequency:** Daily at 03:00 UTC (07:00 AM Georgia Time) via GitHub Actions (`.github/workflows/db-backup.yml`).
- **Engine:** PostgreSQL 17 client `pg_dump` with `--clean --if-exists --no-owner --no-privileges`.
- **Compression:** Gzip level 9 (`.sql.gz`).
- **Encryption:** OpenSSL AES-256-CBC with PBKDF2 key derivation (100,000 iterations) (`.sql.gz.enc`). Raw SQL is never transmitted or stored unencrypted.
- **Storage Target:** S3-compatible object storage (Cloudflare R2 or AWS S3).
- **Retention Policy:**
  - **Daily:** Retains the 7 most recent daily snapshots in `s3://<bucket>/daily/`.
  - **Weekly:** Saves Sunday snapshots to `s3://<bucket>/weekly/` and retains 4 weekly snapshots (1 month of history).

---

## 2. GitHub Secrets Configuration (Cloudflare R2 vs AWS S3)

To activate the automated workflow, add the following secrets in your GitHub repository:
**GitHub Repository -> Settings -> Secrets and variables -> Actions -> New repository secret**

### Comparison: Cloudflare R2 vs AWS S3

| Secret Name | Cloudflare R2 | AWS S3 | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` (or `BACKUP_DATABASE_URL`) | **Mandatory** | **Mandatory** | Full Neon PostgreSQL connection string with `?sslmode=require`. |
| `BACKUP_ENCRYPTION_KEY` | **Mandatory** | **Mandatory** | Strong random passphrase for AES-256 encryption. |
| `S3_BUCKET_NAME` | **Mandatory** | **Mandatory** | Dedicated bucket name (e.g. `medamarket-backups`). |
| `S3_ACCESS_KEY_ID` | **Mandatory** | **Mandatory** | R2 API token Access Key ID or AWS IAM Access Key. |
| `S3_SECRET_ACCESS_KEY` | **Mandatory** | **Mandatory** | R2 API token Secret Access Key or AWS IAM Secret Key. |
| `S3_ENDPOINT` | **Mandatory** | *Optional / Omit* | Cloudflare R2 Endpoint: `https://<account-id>.r2.cloudflarestorage.com`. (Leave empty for AWS S3). |
| `S3_REGION` | *Optional (defaults to `auto`)* | **Recommended** | `auto` for R2; e.g. `eu-central-1` or `us-east-1` for AWS. |

> [!IMPORTANT]
> All credentials are automatically masked in GitHub Actions execution logs to prevent leakage.

---

## 3. Step-by-Step Setup Guide

### Step 3.1: Cloudflare R2 Setup (Free tier includes 10 GB storage)
1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com).
2. In the left navigation, select **R2** (or **Storage & Databases** -> **R2**).
3. Click **Create bucket**, name it `medamarket-backups`, and select your preferred location (e.g. Western Europe / Automatic).
4. On the R2 overview page, click **Manage R2 API Tokens** (in the right sidebar).
5. Click **Create API token**:
   - Token name: `medamarket-github-backup`
   - Permissions: **Object Read & Write**
   - Apply to specific bucket: `medamarket-backups`
6. Click **Create API Token**.
7. Copy the following values immediately:
   - **Access Key ID** -> `S3_ACCESS_KEY_ID`
   - **Secret Access Key** -> `S3_SECRET_ACCESS_KEY`
   - **Endpoint** (format: `https://<account-id>.r2.cloudflarestorage.com`) -> `S3_ENDPOINT`

### Step 3.2: Configure GitHub Secrets
1. Go to your GitHub repository: `https://github.com/GiorgiGiorgadze13/medamarket-`
2. Click **Settings** (top bar).
3. In the left sidebar, click **Secrets and variables** -> **Actions**.
4. Click **New repository secret** for each of the following:
   - `BACKUP_DATABASE_URL`: Your Neon database URL (`postgres://...`).
   - `BACKUP_ENCRYPTION_KEY`: A strong secret password (e.g., generate a 32-character random string).
   - `S3_ENDPOINT`: `https://<account-id>.r2.cloudflarestorage.com` (for R2).
   - `S3_BUCKET_NAME`: `medamarket-backups`
   - `S3_ACCESS_KEY_ID`: `<R2 Access Key>`
   - `S3_SECRET_ACCESS_KEY`: `<R2 Secret Key>`
   - `S3_REGION`: `auto`

---

## 4. How to Trigger and Verify a Backup

1. Go to your GitHub repository.
2. Click the **Actions** tab.
3. Select **MedaMarket Daily Database Backup & Encryption** from the left list.
4. Click **Run workflow** -> **Run workflow**.
5. Click into the workflow run to observe the steps:
   - `Install Latest PostgreSQL Client (PGDG 17) & Tools`
   - `Verify Environment Secrets`
   - `Run Database Dump, Compress & Encrypt`
   - `Upload to Offsite Storage`
   - `Apply Retention Policy`
6. Open your Cloudflare R2 bucket (`medamarket-backups/daily/`) to verify that the file `medamarket_YYYYMMDD_HHMMSS.sql.gz.enc` and `.sha256` checksum are uploaded.

---

## 5. Database Restoration Procedure (Disaster Recovery)

> [!CAUTION]
> NEVER restore against the live production database! Always test restoration against a dedicated staging, Neon branch, or local database.

### Prerequisites
- Node.js (v18+) or Bash shell.

### Method A: Using Cross-Platform Node.js Script (Windows / macOS / Linux)

```bash
# 1. Download the encrypted backup from your storage bucket
# e.g. medamarket_20261113_030000.sql.gz.enc

# 2. Run the restoration tool (decrypts natively with Node crypto)
node scripts/restore-database.js \
  --backup ./medamarket_20261113_030000.sql.gz.enc \
  --target-url "postgresql://staging_user:staging_pass@ep-staging.eu-central-1.aws.neon.tech/staging_db?sslmode=require" \
  --key "YOUR_BACKUP_ENCRYPTION_KEY" \
  --confirm-staging
```

### Method B: Using Bash Script (Linux / macOS / Git Bash)

```bash
chmod +x ./scripts/restore-database.sh
./scripts/restore-database.sh \
  ./medamarket_20261113_030000.sql.gz.enc \
  "postgresql://staging_user:staging_pass@ep-staging.eu-central-1.aws.neon.tech/staging_db?sslmode=require" \
  "YOUR_BACKUP_ENCRYPTION_KEY" \
  --confirm-staging
```

---

## 6. Post-Restoration Data Verification Queries

After restoring into your test database, run these SQL queries to verify data integrity:

```sql
-- 1. Check total record counts
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
