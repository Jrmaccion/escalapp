// scripts/dev-setup.ts
/**
 * Automated Development Environment Setup
 *
 * This script sets up a complete local development environment:
 * 1. Checks/creates .env.local from template
 * 2. Validates environment variables
 * 3. Installs dependencies (if needed)
 * 4. Generates Prisma client
 * 5. Creates/migrates database
 * 6. Seeds database with test data
 * 7. Optionally opens Prisma Studio
 *
 * Usage:
 *   npm run dev:setup
 *   npm run dev:setup -- --skip-seed
 *   npm run dev:setup -- --skip-studio
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import * as dotenv from "dotenv";
import { checkEnvironmentSafety, printEnvironmentCheck } from "./safety-check";

// ========================================
// Configuration
// ========================================

const CONFIG = {
  envLocalPath: path.join(process.cwd(), ".env.local"),
  envLocalExamplePath: path.join(process.cwd(), ".env.local.example"),
  envExamplePath: path.join(process.cwd(), ".env.example"),
  nodeModulesPath: path.join(process.cwd(), "node_modules"),
  prismaSchemaPath: path.join(process.cwd(), "prisma", "schema.prisma"),
};

// ========================================
// Utilities
// ========================================

function log(message: string): void {
  console.log(`[SETUP] ${message}`);
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
  console.log(`\n[${ step}/${total}] ${message}`);
  console.log("=".repeat(60));
}

/**
 * Execute a command and handle errors gracefully
 */
function runCommand(command: string, description: string, options: { silent?: boolean } = {}): boolean {
  try {
    log(description);
    const output = execSync(command, {
      stdio: options.silent ? "pipe" : "inherit",
      encoding: "utf-8",
    });

    if (options.silent && output) {
      console.log(output);
    }

    logSuccess(`${description} - Done`);
    return true;
  } catch (error: any) {
    logError(`${description} - Failed`);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    return false;
  }
}

/**
 * Check if a file exists
 */
function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Read file content
 */
function readFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Write file content
 */
function writeFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Parse command line arguments
 */
function parseArgs(): {
  skipSeed: boolean;
  skipStudio: boolean;
  force: boolean;
  quick: boolean;
} {
  const args = process.argv.slice(2);
  return {
    skipSeed: args.includes("--skip-seed"),
    skipStudio: args.includes("--skip-studio"),
    force: args.includes("--force") || args.includes("-f"),
    quick: args.includes("--quick") || args.includes("-q"),
  };
}

// ========================================
// Setup Steps
// ========================================

/**
 * Step 1: Check/Create .env.local
 */
function setupEnvironmentFile(): boolean {
  if (fileExists(CONFIG.envLocalPath)) {
    logSuccess(".env.local already exists");

    // Load and validate it
    try {
      dotenv.config({ path: CONFIG.envLocalPath });
      return true;
    } catch (error) {
      logWarning(".env.local exists but couldn't be loaded");
      return false;
    }
  }

  logInfo(".env.local not found - creating from template...");

  // Try .env.local.example first, fallback to .env.example
  let templatePath: string;
  if (fileExists(CONFIG.envLocalExamplePath)) {
    templatePath = CONFIG.envLocalExamplePath;
    logInfo(`Using template: .env.local.example`);
  } else if (fileExists(CONFIG.envExamplePath)) {
    templatePath = CONFIG.envExamplePath;
    logInfo(`Using template: .env.example`);
  } else {
    logError("No environment template found (.env.local.example or .env.example)");
    return false;
  }

  try {
    const templateContent = readFile(templatePath);
    writeFile(CONFIG.envLocalPath, templateContent);
    logSuccess("Created .env.local from template");

    // Load the new file
    dotenv.config({ path: CONFIG.envLocalPath });
    return true;
  } catch (error: any) {
    logError(`Failed to create .env.local: ${error.message}`);
    return false;
  }
}

/**
 * Step 2: Validate environment
 */
function validateEnvironment(): boolean {
  logInfo("Validating environment configuration...");

  const check = checkEnvironmentSafety();
  printEnvironmentCheck(check);

  if (!check.isSafe) {
    logError("Environment validation failed");
    logInfo("\nTo fix this:");
    logInfo("  1. Edit .env.local");
    logInfo("  2. Set DEPLOYMENT_ENV='local'");
    logInfo("  3. Set DATABASE_URL to a local database");
    logInfo("     Example: DATABASE_URL='file:./dev.db' (SQLite)");
    logInfo("  4. Run this script again: npm run dev:setup\n");
    return false;
  }

  return true;
}

/**
 * Step 3: Check dependencies
 */
function checkDependencies(): boolean {
  if (!fileExists(CONFIG.nodeModulesPath)) {
    logWarning("node_modules not found - installing dependencies...");
    return runCommand("npm install", "Installing dependencies");
  }

  logSuccess("Dependencies already installed");
  return true;
}

/**
 * Step 4: Generate Prisma Client
 */
function generatePrismaClient(): boolean {
  logInfo("Generating Prisma Client...");

  if (!fileExists(CONFIG.prismaSchemaPath)) {
    logError("Prisma schema not found at prisma/schema.prisma");
    return false;
  }

  return runCommand("npx prisma generate", "Generating Prisma Client");
}

/**
 * Step 5: Setup Database
 */
function setupDatabase(skipMigration: boolean = false): boolean {
  logInfo("Setting up database...");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logError("DATABASE_URL not set in .env.local");
    return false;
  }

  // For SQLite, check if database exists
  if (databaseUrl.startsWith("file:")) {
    const dbPath = databaseUrl.replace("file:", "");
    if (fileExists(dbPath)) {
      logInfo(`SQLite database already exists at ${dbPath}`);
      logInfo("Applying migrations...");
      return runCommand("npx prisma migrate deploy", "Applying migrations");
    } else {
      logInfo("Creating new SQLite database...");
      return runCommand("npx prisma migrate dev --name init", "Creating database and applying migrations");
    }
  }

  // For PostgreSQL
  if (skipMigration) {
    logInfo("Skipping migrations (quick mode)");
    return true;
  }

  logInfo("Running database migrations...");
  return runCommand("npx prisma migrate dev", "Running migrations");
}

/**
 * Step 6: Seed Database
 */
function seedDatabase(skipSeed: boolean): boolean {
  if (skipSeed) {
    logInfo("Skipping database seeding (--skip-seed)");
    return true;
  }

  logInfo("Seeding database with test data...");

  // Check if seed file exists
  const seedPath = path.join(process.cwd(), "prisma", "seed.ts");
  if (!fileExists(seedPath)) {
    logWarning("No seed file found at prisma/seed.ts - skipping seed");
    return true;
  }

  return runCommand("npm run db:seed-dev", "Seeding database");
}

/**
 * Step 7: Create Admin User
 */
function createAdminUser(): boolean {
  logInfo("Creating admin user...");

  const adminEmail = process.env.ADMIN_EMAIL || "admin@escalapp.com";
  logInfo(`Admin email: ${adminEmail}`);

  return runCommand("npm run create-admin", "Creating admin user");
}

/**
 * Step 8: Open Prisma Studio
 */
function openPrismaStudio(skipStudio: boolean): void {
  if (skipStudio) {
    logInfo("Skipping Prisma Studio (--skip-studio)");
    return;
  }

  logInfo("\n📊 Opening Prisma Studio in 3 seconds...");
  logInfo("   Press Ctrl+C to skip, or wait to open Studio");

  setTimeout(() => {
    try {
      execSync("npx prisma studio", { stdio: "inherit" });
    } catch (error) {
      logInfo("Prisma Studio closed or skipped");
    }
  }, 3000);
}

/**
 * Print final success message
 */
function printSuccessMessage(): void {
  console.log("\n" + "=".repeat(60));
  console.log("✅ Development environment setup complete!");
  console.log("=".repeat(60));
  console.log("\n🚀 Next steps:\n");
  console.log("   1. Start development server:");
  console.log("      npm run dev");
  console.log("\n   2. Open your browser:");
  console.log("      http://localhost:3000");
  console.log("\n   3. Login with admin credentials:");
  console.log(`      Email: ${process.env.ADMIN_EMAIL || "admin@escalapp.com"}`);
  console.log(`      Password: ${process.env.ADMIN_PASSWORD || "admin123"}`);
  console.log("\n   4. Explore your database:");
  console.log("      npm run db:studio");
  console.log("\n📚 Documentation:");
  console.log("   See DEV_SETUP_GUIDE.md for more information");
  console.log("\n" + "=".repeat(60) + "\n");
}

/**
 * Print quick setup success message
 */
function printQuickSuccessMessage(): void {
  console.log("\n✅ Quick setup complete!");
  console.log("   Run 'npm run dev' to start development\n");
}

// ========================================
// Main Setup Flow
// ========================================

async function main(): Promise<void> {
  console.log("\n");
  console.log("╔" + "=".repeat(58) + "╗");
  console.log("║" + " ".repeat(10) + "🚀 Escalapp Development Setup" + " ".repeat(17) + "║");
  console.log("╚" + "=".repeat(58) + "╝");
  console.log("\n");

  const args = parseArgs();
  const totalSteps = args.quick ? 5 : 8;
  let currentStep = 0;

  // Step 1: Environment File
  logStep(++currentStep, totalSteps, "Environment Configuration");
  if (!setupEnvironmentFile()) {
    logError("Setup failed at environment configuration");
    process.exit(1);
  }

  // Step 2: Validate Environment
  logStep(++currentStep, totalSteps, "Environment Validation");
  if (!validateEnvironment()) {
    logError("Setup failed at environment validation");
    process.exit(1);
  }

  // Step 3: Dependencies
  logStep(++currentStep, totalSteps, "Dependencies Check");
  if (!checkDependencies()) {
    logError("Setup failed at dependencies check");
    process.exit(1);
  }

  // Step 4: Prisma Client
  logStep(++currentStep, totalSteps, "Prisma Client Generation");
  if (!generatePrismaClient()) {
    logError("Setup failed at Prisma client generation");
    process.exit(1);
  }

  // Step 5: Database Setup
  logStep(++currentStep, totalSteps, "Database Setup");
  if (!setupDatabase(args.quick)) {
    logError("Setup failed at database setup");
    process.exit(1);
  }

  if (args.quick) {
    printQuickSuccessMessage();
    return;
  }

  // Step 6: Seed Database
  logStep(++currentStep, totalSteps, "Database Seeding");
  seedDatabase(args.skipSeed);

  // Step 7: Create Admin User
  logStep(++currentStep, totalSteps, "Admin User Creation");
  if (!createAdminUser()) {
    logWarning("Admin user creation failed - you may need to create one manually");
  }

  // Step 8: Prisma Studio
  logStep(++currentStep, totalSteps, "Prisma Studio");
  openPrismaStudio(args.skipStudio);

  // Success!
  printSuccessMessage();
}

// ========================================
// Entry Point
// ========================================

// Handle errors gracefully
process.on("uncaughtException", (error) => {
  logError(`Uncaught exception: ${error.message}`);
  console.error(error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logError(`Unhandled rejection at ${promise}: ${reason}`);
  process.exit(1);
});

// Run main function
main().catch((error) => {
  logError(`Setup failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
