/**
 * MedaMarket Disaster Recovery - Database Restoration Script
 *
 * Supported OS: Windows, macOS, Linux (Cross-platform)
 * Zero external CLI dependencies required for decryption and decompression.
 *
 * Safety & Security Rules:
 *   1. NEVER restore directly into the production database.
 *   2. Authoritative production database detection: reads backend/.env independently.
 *      Never allows environment variables to override or mask production identity.
 *   3. Fail-safe design: aborts immediately if production database identity is uncertain.
 *   4. Mandates matching SHA-256 checksum file (.sha256) for all backups before decryption.
 *   5. Connection strings and passwords are masked in logs and kept out of CLI process arguments.
 *   6. Strict error handling: psql uses -v ON_ERROR_STOP=1 so SQL errors halt immediately.
 *   7. Byte-compatible with existing AES-256-CBC PBKDF2 (100,000 iterations) and gzip backups.
 *
 * Usage:
 *   # Option 1: Direct from Google Drive (downloads latest backup and its checksum)
 *   node scripts/restore-database.js \
 *     --from-gdrive latest \
 *     --target-url "postgresql://staging_user:pass@ep-staging.eu-central-1.aws.neon.tech/neondb?sslmode=require" \
 *     --key "YOUR_BACKUP_ENCRYPTION_KEY" \
 *     --confirm-staging
 *
 *   # Option 2: Using a locally downloaded backup file (requires .sha256 alongside)
 *   node scripts/restore-database.js \
 *     --backup ./backups/medamarket_20261113.sql.gz.enc \
 *     --target-url "postgresql://staging_user:pass@ep-staging.eu-central-1.aws.neon.tech/neondb?sslmode=require" \
 *     --key "YOUR_BACKUP_ENCRYPTION_KEY" \
 *     --confirm-staging
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execSync } = require('child_process');

/**
 * Safely masks database credentials for display in console and logs.
 */
function maskUrl(rawUrl) {
  if (!rawUrl) return '';
  return rawUrl.replace(/(postgres(?:ql)?:\/\/)([^:]+):([^@]+)@/i, '$1$2:***@');
}

/**
 * Parses hostname and pathname from a database connection URI.
 */
function parseHostAndDb(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return {
      host: parsed.hostname.toLowerCase(),
      pathname: parsed.pathname.toLowerCase()
    };
  } catch {
    return { host: '', pathname: '' };
  }
}

/**
 * Reads the authoritative production DATABASE_URL strictly from backend/.env.
 * Never allows process.env to override or hide the real production destination.
 */
function getAuthoritativeProductionDbUrl() {
  const envPath = path.resolve(__dirname, '../backend/.env');
  if (!fs.existsSync(envPath)) {
    return null;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      const val = trimmed.replace(/^DATABASE_URL=/, '').replace(/^["']|["']$/g, '').trim();
      if (val.length > 0) {
        return val;
      }
    }
  }
  return null;
}

/**
 * Parses command line arguments.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    confirmStaging: false,
    keepSql: false,
    fromGdrive: null,
    backup: null,
    targetUrl: null,
    key: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--backup' || args[i] === '-b') options.backup = args[++i];
    else if (args[i] === '--from-gdrive' || args[i] === '-g') {
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        options.fromGdrive = next;
        i++;
      } else {
        options.fromGdrive = 'latest';
      }
    }
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
 * Matches exact format from .github/workflows/db-backup-gdrive.yml.
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

/**
 * Checks if a CLI command is available in PATH.
 */
function checkCommandAvailable(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Automatically verifies the SHA-256 checksum file (.sha256) before decryption.
 * Fails safely if the checksum file is missing or the hash does not match.
 */
function verifySha256Checksum(backupFilePath) {
  const checksumPath = `${backupFilePath}.sha256`;

  if (!fs.existsSync(checksumPath)) {
    throw new Error(
      `Mandatory checksum file missing: ${path.basename(checksumPath)}\n` +
      `Every backup file must be accompanied by its .sha256 verification file in the same directory.\n` +
      `Ensure you downloaded ${path.basename(checksumPath)} alongside ${path.basename(backupFilePath)}.`
    );
  }

  const checksumRaw = fs.readFileSync(checksumPath, 'utf8').trim();
  const expectedHash = checksumRaw.split(/\s+/)[0].toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error(`Invalid SHA-256 format in checksum file: ${checksumPath}`);
  }

  console.log(`Verifying SHA-256 integrity for ${path.basename(backupFilePath)}...`);
  const fileBytes = fs.readFileSync(backupFilePath);
  const actualHash = crypto.createHash('sha256').update(fileBytes).digest('hex').toLowerCase();

  if (actualHash !== expectedHash) {
    throw new Error(
      `Checksum verification FAILED for ${path.basename(backupFilePath)}!\n` +
      `  Expected: ${expectedHash}\n` +
      `  Computed: ${actualHash}\n` +
      `The backup file may be corrupted, incomplete, or modified. Decryption halted.`
    );
  }

  console.log(`  [OK] SHA-256 checksum verified: ${actualHash}`);
}

/**
 * Downloads backup and its mandatory .sha256 checksum from Google Drive using rclone.
 */
function downloadFromGoogleDrive(targetItem) {
  if (!checkCommandAvailable('rclone')) {
    throw new Error(
      "rclone is not installed in PATH. Please install rclone to use --from-gdrive, or download both the .sql.gz.enc and .sha256 files manually from Google Drive (folder 'MedaMarket-Backups/daily') and pass --backup <file>."
    );
  }

  let remoteFilename = targetItem;
  if (targetItem === 'latest') {
    console.log("Querying Google Drive for the latest backup in 'MedaMarket-Backups/daily/'...");
    const filesList = execSync('rclone lsf "gdrive:MedaMarket-Backups/daily/"', { encoding: 'utf8' })
      .split(/\r?\n/)
      .map((f) => f.trim())
      .filter((f) => f.endsWith('.enc'))
      .sort()
      .reverse();

    if (filesList.length === 0) {
      throw new Error("No encrypted backups (.enc) found in Google Drive folder 'MedaMarket-Backups/daily/'.");
    }
    remoteFilename = filesList[0];
    console.log(`Latest backup identified: ${remoteFilename}`);
  }

  const downloadsDir = path.resolve('./backups');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const localBackupPath = path.join(downloadsDir, remoteFilename);
  const localChecksumPath = `${localBackupPath}.sha256`;

  console.log(`Downloading ${remoteFilename} from Google Drive...`);
  execSync(`rclone copyto "gdrive:MedaMarket-Backups/daily/${remoteFilename}" "${localBackupPath}"`, { stdio: 'inherit' });

  console.log(`Downloading ${remoteFilename}.sha256 checksum from Google Drive...`);
  try {
    execSync(`rclone copyto "gdrive:MedaMarket-Backups/daily/${remoteFilename}.sha256" "${localChecksumPath}"`, { stdio: 'inherit' });
  } catch (err) {
    throw new Error(`Failed to download required checksum file from Google Drive: ${remoteFilename}.sha256`);
  }

  return localBackupPath;
}

async function main() {
  const args = parseArgs();

  if (args.help || (!args.backup && !args.fromGdrive) || !args.targetUrl) {
    console.log(`
MedaMarket Safe Disaster Recovery Restoration Tool
==================================================
Usage:
  node scripts/restore-database.js [options]

Required Target:
  --target-url, -t        Target PostgreSQL Connection URL (STAGING / TEST ONLY)
  --confirm-staging       Required safety flag confirming the target is NOT production

Backup Source (Choose one):
  --from-gdrive, -g       Download directly from Google Drive ('latest' or specific filename)
  --backup, -b            Path to local encrypted backup file (.sql.gz.enc) with matching .sha256

Optional:
  --key, -k               Encryption passphrase (or export BACKUP_ENCRYPTION_KEY)
  --keep-sql              Keep decrypted .sql file after completion
  --help, -h              Show this help message

Examples:
  # 1. Download and restore latest backup from Google Drive
  node scripts/restore-database.js \\
    --from-gdrive latest \\
    --target-url "postgresql://staging_user:pass@ep-staging.neon.tech/neondb?sslmode=require" \\
    --key "your_secret_passphrase" \\
    --confirm-staging

  # 2. Restore from a locally downloaded file
  node scripts/restore-database.js \\
    --backup ./backups/medamarket_20261113.sql.gz.enc \\
    --target-url "postgresql://staging_user:pass@ep-staging.neon.tech/neondb?sslmode=require" \\
    --key "your_secret_passphrase" \\
    --confirm-staging
    `);
    process.exit(args.help ? 0 : 1);
  }

  const targetUrl = args.targetUrl;
  const encryptionKey = args.key || process.env.BACKUP_ENCRYPTION_KEY;

  // Safety Rule 1: Explicit confirmation required
  if (!args.confirmStaging) {
    console.error(`\n[SAFETY ABORT] Missing required safety flag: --confirm-staging`);
    console.error(`You must pass --confirm-staging to acknowledge that the target database is a dedicated test or staging database.`);
    console.error(`Never restore directly into your active production database.`);
    process.exit(1);
  }

  // Safety Rule 2: Authoritative Production URL check
  const authoritativeProdUrl = getAuthoritativeProductionDbUrl();

  // Fail safely if production identity cannot be confirmed
  if (!authoritativeProdUrl) {
    console.error(`\n================================================================`);
    console.error(`[CRITICAL SAFETY BLOCK] Production database identity is uncertain!`);
    console.error(`Could not locate or read the authoritative DATABASE_URL from backend/.env.`);
    console.error(`Restoration aborted to prevent accidental damage to an unknown database.`);
    console.error(`Ensure backend/.env exists with a valid DATABASE_URL.`);
    console.error(`================================================================\n`);
    process.exit(1);
  }

  // Check both authoritative backend/.env and process.env.DATABASE_URL independently
  const prodUrlsToCheck = [authoritativeProdUrl];
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== authoritativeProdUrl.trim()) {
    prodUrlsToCheck.push(process.env.DATABASE_URL.trim());
  }

  for (const pUrl of prodUrlsToCheck) {
    const prodParsed = parseHostAndDb(pUrl);
    const targetParsed = parseHostAndDb(targetUrl);

    const exactMatch = targetUrl.trim() === pUrl.trim();
    const hostAndDbMatch = Boolean(
      prodParsed.host &&
      targetParsed.host &&
      prodParsed.host === targetParsed.host &&
      prodParsed.pathname === targetParsed.pathname
    );

    if (exactMatch || hostAndDbMatch) {
      console.error(`\n================================================================`);
      console.error(`[CRITICAL SAFETY BLOCK] Target URL matches production database!`);
      console.error(`Target Host:     ${targetParsed.host}`);
      console.error(`Target Database: ${targetParsed.pathname}`);
      console.error(`Direct restoration into the active production database is strictly forbidden.`);
      console.error(`Please provide a separate staging branch or test database URL.`);
      console.error(`================================================================\n`);
      process.exit(1);
    }
  }

  let backupPath = args.backup ? path.resolve(args.backup) : null;

  // Download from Google Drive if requested
  if (args.fromGdrive) {
    try {
      backupPath = downloadFromGoogleDrive(args.fromGdrive);
    } catch (err) {
      console.error(`\n[ERROR] Google Drive download failed:`, err.message);
      process.exit(1);
    }
  }

  if (!backupPath || !fs.existsSync(backupPath)) {
    console.error(`[CRITICAL] Backup file not found at: ${backupPath}`);
    process.exit(1);
  }

  // Safety Rule 3: Enforce SHA-256 verification before decryption
  try {
    verifySha256Checksum(backupPath);
  } catch (err) {
    console.error(`\n[INTEGRITY ERROR] ${err.message}\n`);
    process.exit(1);
  }

  console.log(`================================================================`);
  console.log(`MedaMarket Disaster Recovery Restoration`);
  console.log(`================================================================`);
  console.log(`Backup Source:   ${backupPath}`);
  console.log(`Target Database: ${maskUrl(targetUrl)}`);
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

    // 3. Write plain temporary SQL file
    const sqlFilePath = path.join(path.dirname(backupPath), `restore_${Date.now()}_temp.sql`);
    fs.writeFileSync(sqlFilePath, currentBuffer);
    tempFilesToClean.push(sqlFilePath);

    console.log(`Step 3: Executing database restoration...`);
    const psqlExists = checkCommandAvailable('psql');

    if (psqlExists) {
      console.log(`  Found psql client. Executing restore with ON_ERROR_STOP=1...`);
      // Keep credentials out of process arguments: pass connection string via PGDATABASE env
      execSync(`psql -v ON_ERROR_STOP=1 -f "${sqlFilePath}"`, {
        stdio: 'inherit',
        env: {
          ...process.env,
          PGDATABASE: targetUrl,
          PGSSLMODE: 'require'
        }
      });
      console.log(`\n================================================================`);
      console.log(` SUCCESS: Database restoration completed successfully via psql.`);
      console.log(` All tables and records restored cleanly to target database.`);
      console.log(`================================================================`);
    } else {
      console.log(`\n[NOTE] 'psql' client is not installed in the local system PATH.`);
      console.log(`The backup has been fully verified, decrypted, and decompressed to:`);
      console.log(`--> ${sqlFilePath}`);
      console.log(`\nYou can complete the restore into your staging database using any of:`);
      console.log(`  1. Neon Console SQL Editor (Paste & Run the SQL from file)`);
      console.log(`  2. Prisma CLI:`);
      console.log(`     npx --prefix backend prisma db execute --file "${sqlFilePath}" --url "${maskUrl(targetUrl)}"`);
      console.log(`  3. psql CLI (if installed):`);
      console.log(`     psql -v ON_ERROR_STOP=1 "${maskUrl(targetUrl)}" -f "${sqlFilePath}"`);

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
