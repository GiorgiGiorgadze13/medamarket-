/**
 * MedaMarket Disaster Recovery - Database Restoration Script
 *
 * Supported OS: Windows, macOS, Linux (Cross-platform)
 * Zero external CLI dependencies required for decryption and decompression.
 *
 * Usage:
 *   node scripts/restore-database.js \
 *     --backup ./medamarket_20261113.sql.gz.enc \
 *     --target-url "postgresql://user:pass@ep-staging.eu-central-1.aws.neon.tech/staging_db?sslmode=require" \
 *     --key "YOUR_BACKUP_ENCRYPTION_KEY" \
 *     --confirm-staging
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execSync } = require('child_process');

function maskUrl(rawUrl) {
  if (!rawUrl) return '';
  return rawUrl.replace(/(postgres(?:ql)?:\/\/)([^:]+):([^@]+)@/i, '$1$2:***@');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    confirmStaging: false,
    keepSql: false
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--backup' || args[i] === '-b') options.backup = args[++i];
    else if (args[i] === '--target-url' || args[i] === '-t') options.targetUrl = args[++i];
    else if (args[i] === '--key' || args[i] === '-k') options.key = args[++i];
    else if (args[i] === '--confirm-staging') options.confirmStaging = true;
    else if (args[i] === '--keep-sql') options.keepSql = true;
    else if (args[i] === '--help' || args[i] === '-h') options.help = true;
  }
  return options;
}

/**
 * Decrypts OpenSSL AES-256-CBC PBKDF2 formatted buffers natively using Node crypto.
 * No external openssl binary required.
 */
function decryptOpenSslAes256(encryptedBuffer, passphrase) {
  if (encryptedBuffer.subarray(0, 8).toString('utf8') !== 'Salted__') {
    throw new Error('Invalid OpenSSL encrypted file format (missing Salted__ header)');
  }

  const salt = encryptedBuffer.subarray(8, 16);
  const ciphertext = encryptedBuffer.subarray(16);

  // Derive 32-byte key + 16-byte IV using PBKDF2 with SHA-256 and 100,000 iterations
  const derived = crypto.pbkdf2Sync(passphrase, salt, 100000, 48, 'sha256');
  const key = derived.subarray(0, 32);
  const iv = derived.subarray(32, 48);

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function checkPsqlAvailable() {
  try {
    execSync('psql --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs();

  if (args.help || !args.backup || !args.targetUrl) {
    console.log(`
MedaMarket Safe Disaster Recovery Restoration Tool
==================================================
Usage:
  node scripts/restore-database.js [options]

Required Options:
  --backup, -b       Path to encrypted backup (.sql.gz.enc), compressed (.sql.gz), or plain (.sql)
  --target-url, -t   Target PostgreSQL Connection URL (STAGING / TEST ONLY)
  --confirm-staging  Required safety flag confirming the target is NOT production

Optional Options:
  --key, -k          Encryption passphrase (or export BACKUP_ENCRYPTION_KEY)
  --keep-sql         Keep decrypted .sql file after completion
  --help, -h         Show this help message

Examples:
  node scripts/restore-database.js \\
    --backup ./backups/medamarket_20261113.sql.gz.enc \\
    --target-url "postgresql://staging_user:pass@staging-db.neon.tech/staging_db?sslmode=require" \\
    --key "your_secret_passphrase" \\
    --confirm-staging
    `);
    process.exit(args.help ? 0 : 1);
  }

  const backupPath = path.resolve(args.backup);
  const targetUrl = args.targetUrl || process.env.STAGING_DATABASE_URL;
  const encryptionKey = args.key || process.env.BACKUP_ENCRYPTION_KEY;

  if (!fs.existsSync(backupPath)) {
    console.error(`[CRITICAL] Backup file not found at: ${backupPath}`);
    process.exit(1);
  }

  if (!args.confirmStaging) {
    console.error(`\n[SAFETY ABORT] Missing required safety flag: --confirm-staging`);
    console.error(`You must pass --confirm-staging to acknowledge that the target database is a dedicated test or staging database.`);
    console.error(`Never restore directly into your active production database.`);
    process.exit(1);
  }

  // Double safety guard: match against loaded environment variable
  if (process.env.DATABASE_URL && targetUrl.trim() === process.env.DATABASE_URL.trim()) {
    console.error(`\n[CRITICAL SAFETY BLOCK] Target URL matches production DATABASE_URL!`);
    console.error(`Direct restoration into the active production database is strictly forbidden.`);
    console.error(`Please provide a staging, branch, or test database URL.`);
    process.exit(1);
  }

  console.log(`================================================================`);
  console.log(`MedaMarket Disaster Recovery Restoration`);
  console.log(`================================================================`);
  console.log(`Backup Source:   ${backupPath}`);
  console.log(`Target Database: ${maskUrl(targetUrl)}`);
  console.log(`Working Dir:     ${process.cwd()}`);
  console.log(`----------------------------------------------------------------`);

  let currentBuffer = fs.readFileSync(backupPath);
  let fileName = path.basename(backupPath);
  let tempFilesToClean = [];

  try {
    // 1. Decrypt if file ends with .enc
    if (fileName.endsWith('.enc')) {
      if (!encryptionKey) {
        console.error(`[ERROR] File is encrypted (.enc) but no encryption key provided.`);
        console.error(`Pass --key "your_key" or set the BACKUP_ENCRYPTION_KEY environment variable.`);
        process.exit(1);
      }
      console.log(`Step 1: Decrypting AES-256 backup using native PBKDF2...`);
      currentBuffer = decryptOpenSslAes256(currentBuffer, encryptionKey);
      fileName = fileName.replace(/\.enc$/, '');
      console.log(`  Decrypted successfully (${(currentBuffer.length / 1024).toFixed(2)} KB).`);
    }

    // 2. Decompress if file is .gz
    if (fileName.endsWith('.gz')) {
      console.log(`Step 2: Decompressing gzip archive...`);
      currentBuffer = zlib.gunzipSync(currentBuffer);
      fileName = fileName.replace(/\.gz$/, '');
      console.log(`  Decompressed successfully (${(currentBuffer.length / 1024).toFixed(2)} KB raw SQL).`);
    }

    // 3. Write plain SQL file
    const sqlFilePath = path.join(path.dirname(backupPath), `restore_${Date.now()}_temp.sql`);
    fs.writeFileSync(sqlFilePath, currentBuffer);
    tempFilesToClean.push(sqlFilePath);

    console.log(`Step 3: Preparing database execution...`);
    const psqlExists = checkPsqlAvailable();

    if (psqlExists) {
      console.log(`  Found psql client. Executing restore against target database...`);
      execSync(`psql "${targetUrl}" -f "${sqlFilePath}"`, {
        stdio: 'inherit',
        env: { ...process.env, PGSSLMODE: 'require' }
      });
      console.log(`\n================================================================`);
      console.log(` SUCCESS: Database restoration completed successfully via psql.`);
      console.log(` All tables and records restored to target database.`);
      console.log(`================================================================`);
    } else {
      console.log(`\n[NOTE] 'psql' client is not installed in the local system PATH.`);
      console.log(`The backup has been fully decrypted and decompressed to:`);
      console.log(`--> ${sqlFilePath}`);
      console.log(`\nYou can complete the restore into your staging database using any of:`);
      console.log(`  1. psql CLI:`);
      console.log(`     psql "${maskUrl(targetUrl)}" -f "${sqlFilePath}"`);
      console.log(`  2. Docker:`);
      console.log(`     docker run --rm -v "${path.dirname(sqlFilePath)}":/data postgres:17 psql "${maskUrl(targetUrl)}" -f /data/${path.basename(sqlFilePath)}`);
      console.log(`  3. Neon Console SQL Editor / DBeaver / pgAdmin.`);
      
      // Keep SQL file so the user can use it
      args.keepSql = true;
    }
  } catch (err) {
    console.error(`\n[FATAL ERROR] Restoration failed:`, err.message);
    process.exit(1);
  } finally {
    if (!args.keepSql) {
      for (const tempFile of tempFilesToClean) {
        if (fs.existsSync(tempFile)) {
          try {
            fs.unlinkSync(tempFile);
            console.log(`Cleaned temporary unencrypted file: ${path.basename(tempFile)}`);
          } catch {}
        }
      }
    }
  }
}

main();
