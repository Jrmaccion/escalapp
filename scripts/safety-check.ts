// scripts/safety-check.ts
/**
 * Safety Check Utility
 *
 * Prevents accidental execution of destructive commands on production databases.
 * Import this at the top of any script that modifies the database.
 *
 * Usage:
 *   import { requireLocalEnvironment } from "./safety-check";
 *   requireLocalEnvironment();
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env.local if it exists
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

interface EnvironmentCheck {
  isLocal: boolean;
  isSafe: boolean;
  warnings: string[];
  errors: string[];
  info: {
    nodeEnv: string | undefined;
    deploymentEnv: string | undefined;
    databaseUrl: string | undefined;
    databaseType: "sqlite" | "postgresql" | "unknown";
    isProductionDatabase: boolean;
  };
}

/**
 * Checks if the database URL appears to be a local development database
 */
function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;

  const localIndicators = [
    // Localhost variants
    /localhost/i,
    /127\.0\.0\.1/,
    /0\.0\.0\.0/,
    /::1/, // IPv6 localhost

    // Development suffixes
    /_dev/i,
    /_local/i,
    /_test/i,
    /\.local/i,

    // Docker/container patterns
    /-postgres/i,
    /-db/i,
    /-mysql/i,
    /-mariadb/i,
    /docker/i,
    /container/i,

    // SQLite
    /^file:/i,
  ];

  return localIndicators.some((pattern) => pattern.test(url));
}

/**
 * Checks if the database URL appears to be a production database
 */
function isProductionDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;

  // First check if it's explicitly local
  if (isLocalDatabaseUrl(url)) {
    return false;
  }

  const productionIndicators = [
    // Neon production endpoints (usually have 'prod' in the name)
    /ep-.*-prod.*\.aws\.neon\.tech/i,
    /ep-.*-main.*\.aws\.neon\.tech/i,

    // Common production cloud providers
    /\.amazonaws\.com/i,
    /\.azure\.com/i,
    /\.digitalocean\.com/i,
    /\.heroku\.com/i,
    /\.supabase\.co/i,

    // Neon without dev indicators
    /\.neon\.tech/i,

    // Production keywords in URL
    /production/i,
    /prod\./i,
  ];

  return productionIndicators.some((pattern) => pattern.test(url));
}

/**
 * Determines database type from connection string
 */
function getDatabaseType(url: string | undefined): "sqlite" | "postgresql" | "unknown" {
  if (!url) return "unknown";
  if (url.startsWith("file:")) return "sqlite";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return "postgresql";
  return "unknown";
}

/**
 * Performs comprehensive environment safety check
 */
export function checkEnvironmentSafety(): EnvironmentCheck {
  const nodeEnv = process.env.NODE_ENV;
  const deploymentEnv = process.env.DEPLOYMENT_ENV;
  const databaseUrl = process.env.DATABASE_URL;

  const warnings: string[] = [];
  const errors: string[] = [];

  const databaseType = getDatabaseType(databaseUrl);
  const isProductionDatabase = isProductionDatabaseUrl(databaseUrl);

  // Check 1: DEPLOYMENT_ENV should be 'local' for destructive operations
  if (deploymentEnv === "production") {
    errors.push("❌ DEPLOYMENT_ENV is set to 'production'");
    errors.push("   This script cannot run against production databases.");
  } else if (!deploymentEnv) {
    warnings.push("⚠️  DEPLOYMENT_ENV is not set. Recommended: DEPLOYMENT_ENV='local'");
  } else if (deploymentEnv !== "local") {
    warnings.push(`⚠️  DEPLOYMENT_ENV is '${deploymentEnv}' (expected 'local')`);
  }

  // Check 2: NODE_ENV should be 'development' for local dev
  if (nodeEnv === "production") {
    errors.push("❌ NODE_ENV is set to 'production'");
    errors.push("   Local development should use NODE_ENV='development'");
  } else if (!nodeEnv) {
    warnings.push("⚠️  NODE_ENV is not set. Recommended: NODE_ENV='development'");
  }

  // Check 3: Database URL validation
  if (!databaseUrl) {
    errors.push("❌ DATABASE_URL is not set");
    errors.push("   Run 'npm run dev:setup' to configure your local environment");
  } else if (isProductionDatabase) {
    errors.push("❌ DATABASE_URL appears to be a PRODUCTION database!");
    errors.push("   Detected production indicators in connection string");
    errors.push("   Local development should use SQLite or a local PostgreSQL instance");
  }

  // Check 4: Warn about PostgreSQL without explicit local indicators
  if (databaseType === "postgresql" && databaseUrl && !isLocalDatabaseUrl(databaseUrl)) {
    if (!isProductionDatabase) {
      warnings.push("⚠️  PostgreSQL connection doesn't contain typical local indicators");
      warnings.push("   (localhost, _dev, _local, docker, etc.)");
      warnings.push("   Please confirm this is a safe local/development database");
    }
  }

  const isLocal = deploymentEnv === "local" || (nodeEnv === "development" && !isProductionDatabase);
  const isSafe = errors.length === 0 && !isProductionDatabase;

  return {
    isLocal,
    isSafe,
    warnings,
    errors,
    info: {
      nodeEnv,
      deploymentEnv,
      databaseUrl: databaseUrl ? maskDatabaseUrl(databaseUrl) : undefined,
      databaseType,
      isProductionDatabase,
    },
  };
}

/**
 * Masks sensitive parts of database URL for safe logging
 */
function maskDatabaseUrl(url: string): string {
  // Mask password in PostgreSQL URLs
  return url.replace(/(:\/\/[^:]+:)([^@]+)(@)/, "$1****$3");
}

/**
 * Prints environment check results to console
 */
export function printEnvironmentCheck(check: EnvironmentCheck): void {
  console.log("\n🔍 Environment Safety Check");
  console.log("=" .repeat(60));

  console.log("\n📊 Current Environment:");
  console.log(`   NODE_ENV: ${check.info.nodeEnv || "(not set)"}`);
  console.log(`   DEPLOYMENT_ENV: ${check.info.deploymentEnv || "(not set)"}`);
  console.log(`   Database Type: ${check.info.databaseType}`);
  console.log(`   Database URL: ${check.info.databaseUrl || "(not set)"}`);

  if (check.warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    check.warnings.forEach((warning) => console.log(`   ${warning}`));
  }

  if (check.errors.length > 0) {
    console.log("\n❌ Errors:");
    check.errors.forEach((error) => console.log(`   ${error}`));
  }

  console.log("\n" + "=".repeat(60));

  if (check.isSafe) {
    console.log("✅ Environment is SAFE for local development operations\n");
  } else {
    console.log("❌ Environment is NOT SAFE for destructive operations\n");
  }
}

/**
 * Requires a safe local environment or exits with error
 *
 * Use this at the top of any script that modifies the database:
 *   requireLocalEnvironment();
 *   // ... rest of your script
 */
export function requireLocalEnvironment(options: { silent?: boolean } = {}): void {
  const check = checkEnvironmentSafety();

  if (!options.silent) {
    printEnvironmentCheck(check);
  }

  if (!check.isSafe) {
    console.error("\n🚨 SAFETY CHECK FAILED\n");
    console.error("This script cannot proceed because it would run against");
    console.error("a production or unsafe database.\n");
    console.error("To fix this:\n");
    console.error("  1. Ensure you have a .env.local file (copy from .env.local.example)");
    console.error("  2. Set DEPLOYMENT_ENV='local' in your .env.local");
    console.error("  3. Use a local database:");
    console.error("     - SQLite: DATABASE_URL='file:./dev.db'");
    console.error("     - Local Postgres: DATABASE_URL='postgresql://user:pass@localhost:5432/dbname_dev'");
    console.error("\n  Or run: npm run dev:setup\n");

    process.exit(1);
  }
}

/**
 * Interactive confirmation for destructive operations
 */
export async function confirmDestructiveOperation(operationName: string): Promise<boolean> {
  // Check environment first
  const check = checkEnvironmentSafety();
  if (!check.isSafe) {
    printEnvironmentCheck(check);
    console.error(`\n❌ Cannot perform '${operationName}' - environment is not safe\n`);
    return false;
  }

  // In non-interactive environments, check for --force flag
  if (!process.stdin.isTTY) {
    const hasForceFlag = process.argv.includes("--force") || process.argv.includes("-f");
    if (hasForceFlag) {
      console.log(`✅ Force flag detected - proceeding with ${operationName}`);
      return true;
    }

    console.error(`\n❌ Cannot confirm '${operationName}' in non-interactive mode`);
    console.error("   Use --force flag to proceed automatically\n");
    return false;
  }

  // Interactive confirmation
  console.log(`\n⚠️  You are about to perform: ${operationName}`);
  console.log(`   Database: ${check.info.databaseUrl}`);
  console.log(`   Type: ${check.info.databaseType}\n`);

  // Simple readline implementation for Node.js
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
 * Check if running in CI environment
 */
export function isCiEnvironment(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.JENKINS_URL
  );
}

// If run directly, perform a safety check and print results
if (require.main === module) {
  const check = checkEnvironmentSafety();
  printEnvironmentCheck(check);

  if (!check.isSafe) {
    process.exit(1);
  }
}
