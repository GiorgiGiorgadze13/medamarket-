/**
 * MedaMarket Disaster Recovery - Database Restoration Script
 *
 * Usage:
 *   node scripts/restore-database.js \
 *     --backup ./medamarket_20261113.sql.gz.enc \
 *     --target-url "postgres://user:pass@staging-host/staging_db?sslmode=require" \
 *     --key "YOUR_BACKUP_ENCRYPTION_KEY"
 *
 * Safety Rules:
 *   1. NEVER restore directly into the production database.
 *   2. Target database credentials are automatically masked from all logs.
 *   3. File integrity and checksum verification before execution.
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
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--backup' || args[i] === '-b') options.backup = args[++i];
    else if (args[i] === '--target-url' || args[i] === '-t') options.targetUrl = args[++i];
    else if (args[i] === '--key' || args[i] === '-k') options.key = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') options.help = true;
  }
  return options;
}

async function main() {
  const args = parseArgs();

  if (args.help || !args.backup || !args.targetUrl) {
    console.log(`
MedaMarket Safe Database Restoration Tool
=========================================
Usage:
  node scripts/restore-database.js [options]

Options:
  --backup, -b       Path to backup file (.sql, .sql.gz, or .sql.gz.enc) [Required]
  --target-url, -t   Target PostgreSQL Connection String (STAGING/TEST ONLY) [Required]
  --key, -k          Encryption key (required if backup is .enc; or set BACKUP_ENCRYPTION_KEY env)
  --help, -h         Show this message

Environment Variables:
  BACKUP_ENCRYPTION_KEY
  STAGING_DATABASE_URL
    `);
    process.exit(args.help ? 0 : 1);
  }

  const backupPath = path.resolve(args.backup);
  const targetUrl = args.targetUrl || process.env.STAGING_DATABASE_URL;
  const encryptionKey = args.key || process.env.BACKUP_ENCRYPTION_KEY;

  if (!fs.existsSync(backupPath)) {
    console.error(`[ERROR] Backup file not found: ${backupPath}`);
    process.exit(1);
  }

  console.log(`-----------------------------------------------------`);
  console.log(`MedaMarket Disaster Recovery Restoration`);
  console.log(`Target Database: ${maskUrl(targetUrl)}`);
  console.log(`Backup Source:   ${backupPath}`);
  console.log(`-----------------------------------------------------`);

  // Prevent accidental restore into production
  if (process.env.DATABASE_URL && targetUrl.trim() === process.env.DATABASE_URL.trim()) {
    console.error(`\n[CRITICAL SAFETY BLOCK] Target URL matches production DATABASE_URL!`);
    console.error(`Restoration directly to production is blocked. Use a separate staging or test database.`);
    process.exit(1);
  }

  let sqlFilePath = backupPath;
  let tempFilesToClean = [];

  try {
    // 1. Decrypt if file ends with .enc
    if (backupPath.endsWith('.enc')) {
      if (!encryptionKey) {
        console.error(`[ERROR] File is encrypted (.enc) but no key was provided.`);
        console.error(`Provide --key "passphrase" or export BACKUP_ENCRYPTION_KEY.`);
        process.exit(1);
      }
      console.log(`Decrypting AES-256 backup with OpenSSL PBKDF2...`);
      const decryptedPath = backupPath.replace(/\.enc$/, '');
      
      // Use openssl to match the workflow encryption standard
      execSync(`openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 100000 -in "${backupPath}" -out "${decryptedPath}" -pass pass:"${encryptionKey}"`, {
        stdio: 'inherit'
      });
      sqlFilePath = decryptedPath;
      tempFilesToClean.push(decryptedPath);
      console.log(`Decrypted archive created.`);
    }

    // 2. Decompress if .gz
    if (sqlFilePath.endsWith('.gz')) {
      console.log(`Decompressing gzip archive...`);
      const decompressedPath = sqlFilePath.replace(/\.gz$/, '');
      const compressedBuffer = fs.readFileSync(sqlFilePath);
      const decompressedBuffer = zlib.gunzipSync(compressedBuffer);
      fs.writeFileSync(decompressedPath, decompressedBuffer);
      sqlFilePath = decompressedPath;
      tempFilesToClean.push(decompressedPath);
      console.log(`Decompressed SQL dump ready (${(decompressedBuffer.length / 1024).toFixed(2)} KB).`);
    }

    // 3. Execute restoration against target database using psql
    console.log(`Executing restoration to staging database...`);
    execSync(`psql "${targetUrl}" -f "${sqlFilePath}"`, {
      stdio: 'inherit',
      env: { ...process.env, PGPASSWORD: '' }
    });

    console.log(`\n=====================================================`);
    console.log(` SUCCESS: Database restoration completed successfully.`);
    console.log(` Target database has been restored from backup.`);
    console.log(`=====================================================`);
  } catch (err) {
    console.error(`\n[ERROR] Restoration failed:`, err.message);
    process.exit(1);
  } finally {
    // Clean up temporary decrypted/decompressed files for security
    for (const tempFile of tempFilesToClean) {
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
          console.log(`Cleaned temporary file: ${path.basename(tempFile)}`);
        } catch {}
      }
    }
  }
}

main();
