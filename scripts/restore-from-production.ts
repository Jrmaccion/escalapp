// scripts/restore-from-production.ts
/**
 * Restore Local Database from Production
 *
 * Downloads production data and restores it to your local database.
 * ⚠️ WARNING: This will DELETE all local data!
 *
 * What it does:
 * 1. Dumps production database (structure + data)
 * 2. Saves backup file locally
 * 3. Restores to local database
 *
 * Usage:
 *   npm run db:restore-from-prod
 *   npm run db:restore-from-prod -- --force
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import * as dotenv from "dotenv";
import { requireLocalEnvironment, confirmDestructiveOperation } from "./safety-check";

// ========================================
// Configuration
// ========================================

const CONFIG = {
  envProductionPath: path.join(process.cwd(), ".env.production.local"),
  envLocalPath: path.join(process.cwd(), ".env.local"),
  backupsDir: path.join(process.cwd(), "backups"),
};

// ========================================
// Utilities
// ========================================

function log(message: string): void {
  console.log(`[RESTORE] ${message}`);
}

function logSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

function logError(message: string): void {
  console.error(`❌ ${message}`);
}

function logWarning(message: string): void {
  console.warn(`⚠️  ${message}`);
}

function logInfo(message: string): void {
  console.log(`ℹ️  ${message}`);
}

function logStep(step: number, total: number, message: string): void {
  console.log(`\n[${step}/${total}] ${message}`);
  console.log("=".repeat(60));
}

/**
 * Execute a command
 */
function runCommand(command: string, description: string): boolean {
  try {
    log(description);
    execSync(command, { stdio: "inherit" });
    logSuccess(`${description} - Done`);
    return true;
  } catch (error: any) {
    logError(`${description} - Failed`);
    return false;
  }
}

/**
 * Check if pg_dump and psql are available
 */
function checkPostgresTools(): boolean {
  try {
    execSync("pg_dump --version", { stdio: "pipe" });
    execSync("psql --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get database URL from env file
 */
function getDatabaseUrl(envPath: string): string | null {
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * Mask password in database URL
 */
function maskDatabaseUrl(url: string): string {
  return url.replace(/(:\/\/[^:]+:)([^@]+)(@)/, "$1****$3");
}

/**
 * Create backup directory
 */
function ensureBackupDir(): void {
  if (!fs.existsSync(CONFIG.backupsDir)) {
    fs.mkdirSync(CONFIG.backupsDir, { recursive: true });
    logSuccess(`Created backups directory: ${CONFIG.backupsDir}`);
  }
}

/**
 * Generate backup filename with timestamp
 */
function getBackupFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0] + "_" +
    new Date().toTimeString().split(" ")[0].replace(/:/g, "");
  return path.join(CONFIG.backupsDir, `production_backup_${timestamp}.sql`);
}

/**
 * Check if running in Docker
 */
function isDockerDatabase(url: string): boolean {
  return url.includes("escalapp-postgres") ||
         url.includes("docker") ||
         url.includes("container");
}

// ========================================
// Main Steps
// ========================================

async function main(): Promise<void> {
  console.log("\n");
  console.log("╔" + "=".repeat(58) + "╗");
  console.log("║" + " ".repeat(8) + "🔄 Restore Database from Production" + " ".repeat(13) + "║");
  console.log("╚" + "=".repeat(58) + "╝");
  console.log("\n");

  // Step 1: Safety Check
  logStep(1, 6, "Safety Check");
  logInfo("Verifying local environment...");
  requireLocalEnvironment();
  logSuccess("Local environment verified");

  // Step 2: Confirmation
  logStep(2, 6, "Confirmation");
  const confirmed = await confirmDestructiveOperation(
    "Restore from Production (DELETES all local data)"
  );
  if (!confirmed) {
    logInfo("Operation cancelled by user");
    process.exit(0);
  }

  // Step 3: Check PostgreSQL Tools
  logStep(3, 6, "Check PostgreSQL Tools");

  if (!checkPostgresTools()) {
    logError("PostgreSQL tools (pg_dump, psql) not found in PATH");
    logInfo("\nPlease install PostgreSQL:");
    logInfo("  Windows: https://www.postgresql.org/download/windows/");
    logInfo("  Or add PostgreSQL bin directory to PATH");
    logInfo("  Example: C:\\Program Files\\PostgreSQL\\17\\bin");
    process.exit(1);
  }

  logSuccess("PostgreSQL tools found");

  // Step 4: Load Database URLs
  logStep(4, 6, "Load Database Connections");

  // Load production URL
  if (!fs.existsSync(CONFIG.envProductionPath)) {
    logError(`Production config not found: ${CONFIG.envProductionPath}`);
    logInfo("Create .env.production.local with production DATABASE_URL");
    process.exit(1);
  }

  const productionUrl = getDatabaseUrl(CONFIG.envProductionPath);
  if (!productionUrl) {
    logError("Could not find DATABASE_URL in .env.production.local");
    process.exit(1);
  }

  logInfo(`Production: ${maskDatabaseUrl(productionUrl)}`);

  // Load local URL from .env.local
  dotenv.config({ path: CONFIG.envLocalPath });
  const localUrl = process.env.DATABASE_URL;

  if (!localUrl) {
    logError("Could not find DATABASE_URL in .env.local");
    process.exit(1);
  }

  logInfo(`Local: ${maskDatabaseUrl(localUrl)}`);

  // Check if local is Docker
  const isDocker = isDockerDatabase(localUrl);
  if (isDocker) {
    logInfo("Detected Docker database");
    logWarning("Make sure Docker container is running: docker-compose up -d");
  }

  // Step 5: Create Backup from Production
  logStep(5, 6, "Backup from Production");

  ensureBackupDir();
  const backupFile = getBackupFilename();

  logInfo("Downloading production database...");
  logInfo("This may take several minutes depending on database size...");

  // Add sslmode if not present (for Neon)
  let finalProductionUrl = productionUrl;
  if (!productionUrl.includes("sslmode=")) {
    finalProductionUrl += (productionUrl.includes("?") ? "&" : "?") + "sslmode=require";
  }

  const dumpSuccess = runCommand(
    `pg_dump --format=plain --no-owner --no-privileges --encoding=UTF8 --verbose --dbname="${finalProductionUrl}" --file="${backupFile}"`,
    "Creating database dump"
  );

  if (!dumpSuccess || !fs.existsSync(backupFile)) {
    logError("Failed to create backup from production");
    logInfo("Check your .env.production.local DATABASE_URL is correct");
    process.exit(1);
  }

  const stats = fs.statSync(backupFile);
  logSuccess(`Backup created: ${backupFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

  // Step 6: Restore to Local
  logStep(6, 6, "Restore to Local Database");

  logWarning("This will DELETE all local data and replace it with production data");

  // For Docker, we need to use docker exec
  if (isDocker) {
    logInfo("Restoring via Docker...");

    // Read backup file content
    const backupContent = fs.readFileSync(backupFile, "utf-8");
    const tempFile = path.join(CONFIG.backupsDir, "temp_restore.sql");

    // Create temp file with schema reset
    const resetSql = "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;\\n";
    fs.writeFileSync(tempFile, resetSql + backupContent);

    // Get connection details from URL
    const urlMatch = localUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+?)(\?|$)/);
    if (!urlMatch) {
      logError("Could not parse local DATABASE_URL");
      process.exit(1);
    }

    const [, user, password, host, port, database] = urlMatch;

    // Use docker exec to restore
    const containerName = "escalapp-postgres"; // Adjust if different

    logInfo(`Copying backup to container ${containerName}...`);
    runCommand(
      `docker cp "${tempFile}" ${containerName}:/tmp/restore.sql`,
      "Copy backup to container"
    );

    logInfo("Restoring database...");
    runCommand(
      `docker exec -i ${containerName} psql -U ${user} -d ${database} -f /tmp/restore.sql`,
      "Restore database in container"
    );

    // Cleanup
    fs.unlinkSync(tempFile);

  } else {
    // Direct PostgreSQL connection
    logInfo("Resetting local schema...");
    runCommand(
      `psql "${localUrl}" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"`,
      "Reset local schema"
    );

    logInfo("Restoring data...");
    runCommand(
      `psql "${localUrl}" -f "${backupFile}"`,
      "Restore database"
    );
  }

  // Success!
  console.log("\n" + "=".repeat(60));
  console.log("✅ Database Restored Successfully!");
  console.log("=".repeat(60));
  console.log("\n📊 Summary:\n");
  console.log(`   Source: Production (${maskDatabaseUrl(productionUrl)})`);
  console.log(`   Destination: Local (${maskDatabaseUrl(localUrl)})`);
  console.log(`   Backup saved: ${backupFile}`);
  console.log("\n🔄 Next Steps:\n");
  console.log("   1. Verify data:");
  console.log("      npm run db:studio");
  console.log("\n   2. Generate Prisma Client (if schema changed):");
  console.log("      npm run db:generate");
  console.log("\n   3. Start development:");
  console.log("      npm run dev");
  console.log("\n" + "=".repeat(60) + "\n");
}

// ========================================
// Entry Point
// ========================================

main().catch((error) => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
