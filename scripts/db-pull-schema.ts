// scripts/db-pull-schema.ts
/**
 * Pull Database Schema from Production
 *
 * Synchronizes your local Prisma schema with a remote database (usually production)
 * WITHOUT copying any data - only the schema structure.
 *
 * This is useful when:
 * - Production database has schema changes you want locally
 * - You want to ensure your local schema matches production
 * - You're debugging schema-related issues
 *
 * SAFETY: This only reads from production and writes to your schema file.
 * It does NOT modify any database data.
 *
 * Usage:
 *   npm run db:pull-schema              # Pull from .env.production.local
 *   npm run db:pull-schema -- --env=dev # Pull from .env.dev
 *   npm run db:pull-schema -- --force   # Skip confirmation
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ========================================
// Configuration
// ========================================

const CONFIG = {
  envProductionPath: path.join(process.cwd(), ".env.production.local"),
  envLocalPath: path.join(process.cwd(), ".env.local"),
  prismaSchemaPath: path.join(process.cwd(), "prisma", "schema.prisma"),
  prismaSchemaBackupPath: path.join(process.cwd(), "prisma", "schema.prisma.backup"),
};

// ========================================
// Utilities
// ========================================

function log(message: string): void {
  console.log(`[PULL-SCHEMA] ${message}`);
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

/**
 * Parse command line arguments
 */
function parseArgs(): {
  env: string;
  force: boolean;
} {
  const args = process.argv.slice(2);
  const envArg = args.find((arg) => arg.startsWith("--env="));
  const env = envArg ? envArg.split("=")[1] : "production";
  const force = args.includes("--force") || args.includes("-f");

  return { env, force };
}

/**
 * Load environment file
 */
function loadEnvironmentFile(envName: string): string | null {
  const envFiles = [
    `.env.${envName}.local`,
    `.env.${envName}`,
    envName === "production" ? ".env.production.local" : null,
  ].filter(Boolean) as string[];

  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      logInfo(`Found environment file: ${envFile}`);
      return envPath;
    }
  }

  return null;
}

/**
 * Extract DATABASE_URL from env file
 */
function extractDatabaseUrl(envPath: string): string | null {
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);

    if (match && match[1]) {
      return match[1].trim();
    }

    return null;
  } catch (error: any) {
    logError(`Failed to read env file: ${error.message}`);
    return null;
  }
}

/**
 * Mask sensitive parts of database URL
 */
function maskDatabaseUrl(url: string): string {
  return url.replace(/(:\/\/[^:]+:)([^@]+)(@)/, "$1****$3");
}

/**
 * Backup current schema
 */
function backupSchema(): boolean {
  try {
    if (fs.existsSync(CONFIG.prismaSchemaPath)) {
      const content = fs.readFileSync(CONFIG.prismaSchemaPath, "utf-8");
      fs.writeFileSync(CONFIG.prismaSchemaBackupPath, content, "utf-8");
      logSuccess(`Schema backed up to: ${path.basename(CONFIG.prismaSchemaBackupPath)}`);
      return true;
    }

    logWarning("No existing schema to backup");
    return true;
  } catch (error: any) {
    logError(`Failed to backup schema: ${error.message}`);
    return false;
  }
}

/**
 * Restore schema from backup
 */
function restoreSchema(): boolean {
  try {
    if (fs.existsSync(CONFIG.prismaSchemaBackupPath)) {
      const content = fs.readFileSync(CONFIG.prismaSchemaBackupPath, "utf-8");
      fs.writeFileSync(CONFIG.prismaSchemaPath, content, "utf-8");
      logSuccess("Schema restored from backup");
      return true;
    }

    logError("No backup found to restore");
    return false;
  } catch (error: any) {
    logError(`Failed to restore schema: ${error.message}`);
    return false;
  }
}

/**
 * Interactive confirmation
 */
async function confirmPull(sourceEnv: string, databaseUrl: string): Promise<boolean> {
  // Check for force flag
  if (process.argv.includes("--force") || process.argv.includes("-f")) {
    logInfo("Force flag detected - skipping confirmation");
    return true;
  }

  // In non-interactive environments, require force flag
  if (!process.stdin.isTTY) {
    logError("Cannot confirm in non-interactive mode - use --force flag");
    return false;
  }

  console.log("\n" + "=".repeat(60));
  console.log("⚠️  DATABASE SCHEMA PULL");
  console.log("=".repeat(60));
  console.log("\nYou are about to pull the schema from:");
  console.log(`   Environment: ${sourceEnv}`);
  console.log(`   Database: ${maskDatabaseUrl(databaseUrl)}`);
  console.log("\nThis will:");
  console.log("   ✅ Read schema structure from remote database");
  console.log("   ✅ Update your local prisma/schema.prisma file");
  console.log("   ✅ Create a backup of current schema");
  console.log("   ❌ NOT modify any database data");
  console.log("   ❌ NOT modify remote database");
  console.log("\n" + "=".repeat(60) + "\n");

  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question("   Type 'yes' to continue: ", (answer: string) => {
      readline.close();
      const confirmed = answer.trim().toLowerCase() === "yes";

      if (confirmed) {
        console.log("✅ Confirmed - proceeding...\n");
      } else {
        console.log("❌ Cancelled\n");
      }

      resolve(confirmed);
    });
  });
}

/**
 * Pull schema from database
 */
function pullSchema(databaseUrl: string): boolean {
  try {
    logInfo("Pulling schema from database...");
    logInfo("This may take a moment...\n");

    // Use Prisma db pull with the specified database URL
    execSync(`npx prisma db pull --schema=${CONFIG.prismaSchemaPath}`, {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    });

    logSuccess("\nSchema pulled successfully!");
    return true;
  } catch (error: any) {
    logError("\nFailed to pull schema");
    console.error(error);
    return false;
  }
}

/**
 * Generate Prisma Client
 */
function generateClient(): boolean {
  try {
    logInfo("Generating Prisma Client...");

    execSync("npx prisma generate", {
      stdio: "inherit",
    });

    logSuccess("Prisma Client generated");
    return true;
  } catch (error: any) {
    logError("Failed to generate Prisma Client");
    console.error(error);
    return false;
  }
}

/**
 * Show post-pull instructions
 */
function showPostPullInstructions(): void {
  console.log("\n" + "=".repeat(60));
  console.log("✅ Schema Pull Complete");
  console.log("=".repeat(60));
  console.log("\n📋 Next Steps:\n");
  console.log("   1. Review the changes in prisma/schema.prisma");
  console.log("      Compare with backup: prisma/schema.prisma.backup");
  console.log("\n   2. Create a migration for these changes:");
  console.log("      npm run db:migrate");
  console.log("\n   3. Or apply directly to local database:");
  console.log("      npx prisma db push");
  console.log("\n   4. If you want to undo the pull:");
  console.log("      mv prisma/schema.prisma.backup prisma/schema.prisma");
  console.log("      npm run db:generate");
  console.log("\n" + "=".repeat(60) + "\n");
}

// ========================================
// Main Function
// ========================================

async function main(): Promise<void> {
  console.log("\n");
  console.log("╔" + "=".repeat(58) + "╗");
  console.log("║" + " ".repeat(12) + "🔄 Pull Database Schema" + " ".repeat(20) + "║");
  console.log("╚" + "=".repeat(58) + "╝");
  console.log("\n");

  const args = parseArgs();

  // Step 1: Find environment file
  logInfo(`Looking for ${args.env} environment configuration...`);
  const envPath = loadEnvironmentFile(args.env);

  if (!envPath) {
    logError(`No environment file found for: ${args.env}`);
    logInfo("\nAvailable environments:");
    logInfo("  - production (.env.production.local)");
    logInfo("  - dev (.env.dev or .env.dev.local)");
    logInfo("  - staging (.env.staging or .env.staging.local)");
    logInfo("\nUsage: npm run db:pull-schema -- --env=production");
    process.exit(1);
  }

  // Step 2: Extract DATABASE_URL
  const databaseUrl = extractDatabaseUrl(envPath);

  if (!databaseUrl) {
    logError(`No DATABASE_URL found in ${envPath}`);
    process.exit(1);
  }

  logInfo(`Database: ${maskDatabaseUrl(databaseUrl)}`);

  // Step 3: Validate it's not a local database
  if (
    databaseUrl.includes("localhost") ||
    databaseUrl.includes("127.0.0.1") ||
    databaseUrl.startsWith("file:")
  ) {
    logWarning("This appears to be a local database");
    logInfo("Schema pull is typically used to sync FROM remote databases");

    if (!args.force) {
      logError("Use --force to proceed anyway");
      process.exit(1);
    }
  }

  // Step 4: Confirm with user
  const confirmed = await confirmPull(args.env, databaseUrl);
  if (!confirmed) {
    logInfo("Operation cancelled by user");
    process.exit(0);
  }

  // Step 5: Backup current schema
  if (!backupSchema()) {
    logError("Failed to backup schema - aborting");
    process.exit(1);
  }

  // Step 6: Pull schema
  const pullSuccess = pullSchema(databaseUrl);

  if (!pullSuccess) {
    logError("Schema pull failed");
    logInfo("Restoring from backup...");

    if (restoreSchema()) {
      logInfo("Schema restored from backup");
    } else {
      logError("Failed to restore schema from backup!");
      logError(`Manual restore: mv ${CONFIG.prismaSchemaBackupPath} ${CONFIG.prismaSchemaPath}`);
    }

    process.exit(1);
  }

  // Step 7: Generate Prisma Client
  if (!generateClient()) {
    logWarning("Failed to generate Prisma Client - you may need to run: npm run db:generate");
  }

  // Step 8: Show next steps
  showPostPullInstructions();
}

// ========================================
// Entry Point
// ========================================

main().catch((error) => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
