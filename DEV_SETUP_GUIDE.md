# Development Setup Guide

**Complete guide for setting up and working with Escalapp locally**

---

## 🚀 Quick Start (New Developers)

If you're setting up Escalapp for the first time, follow these steps:

### 1. Clone and Install

```bash
git clone <repository-url>
cd escalapp
npm install
```

### 2. Automated Setup

```bash
npm run dev:setup
```

This single command will:
- ✅ Create `.env.local` from template (if it doesn't exist)
- ✅ Validate your environment is safe
- ✅ Generate Prisma Client
- ✅ Create local database with schema
- ✅ Seed database with test data
- ✅ Create admin user
- ✅ Open Prisma Studio (optional)

### 3. Start Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and login with:
- **Email:** `admin@escalapp.com`
- **Password:** `admin123`

**That's it!** You're ready to start developing.

---

## 📋 Table of Contents

- [Environment Setup](#environment-setup)
- [Database Options](#database-options)
- [NPM Scripts Reference](#npm-scripts-reference)
- [Common Workflows](#common-workflows)
- [Safety Features](#safety-features)
- [Troubleshooting](#troubleshooting)
- [Windows-Specific Notes](#windows-specific-notes)

---

## 🔧 Environment Setup

### Environment Files

The project uses multiple environment files for different purposes:

| File | Purpose | Committed to Git? |
|------|---------|------------------|
| `.env.local.example` | Template for local development | ✅ Yes |
| `.env.local` | Your local development config | ❌ No |
| `.env.production.local` | Production database credentials | ❌ No |
| `.env.example` | Legacy example file | ✅ Yes |

### Setting Up `.env.local`

**Option 1: Automatic (Recommended)**

```bash
npm run dev:setup
```

The setup script will create `.env.local` from the template automatically.

**Option 2: Manual**

```bash
# Copy the template
cp .env.local.example .env.local

# Edit with your preferred editor
code .env.local  # VS Code
notepad .env.local  # Windows Notepad
```

### Key Environment Variables

```bash
# Required
DATABASE_URL="file:./dev.db"  # SQLite (simplest)
NEXTAUTH_SECRET="local-dev-secret"
NEXTAUTH_URL="http://localhost:3000"

# Safety (IMPORTANT!)
DEPLOYMENT_ENV="local"  # Prevents production accidents
NODE_ENV="development"

# Optional
DEBUG="true"
LOG_LEVEL="debug"
```

---

## 💾 Database Options

Choose the database that works best for your workflow:

### Option 1: SQLite (Recommended for Local Dev)

**Pros:**
- No installation required
- Simple file-based storage
- Perfect for local development
- Fast setup

**Setup:**

```bash
# In .env.local
DATABASE_URL="file:./dev.db"
```

```bash
# Run setup
npm run dev:setup
```

### Option 2: Local PostgreSQL

**Pros:**
- Production-like environment
- Advanced features
- Better for complex queries

**Cons:**
- Requires PostgreSQL installation
- More setup complexity

**Setup:**

1. Install PostgreSQL:
   - **Windows:** https://www.postgresql.org/download/windows/
   - **macOS:** `brew install postgresql`
   - **Linux:** `sudo apt-get install postgresql`

2. Create database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE escalapp_dev;
CREATE USER escalapp WITH PASSWORD 'escalapp';
GRANT ALL PRIVILEGES ON DATABASE escalapp_dev TO escalapp;
```

3. Configure `.env.local`:

```bash
DATABASE_URL="postgresql://escalapp:escalapp@localhost:5432/escalapp_dev"
```

4. Run setup:

```bash
npm run dev:setup
```

### Option 3: Neon Development Branch

**Pros:**
- Cloud-based (no local install)
- Close to production environment
- Accessible from anywhere

**Setup:**

1. Create a development branch in Neon Dashboard
2. Copy the connection string
3. In `.env.local`:

```bash
DATABASE_URL="postgresql://user:pass@ep-dev-xxx.neon.tech/dbname?sslmode=require"
```

4. Run setup:

```bash
npm run dev:setup
```

---

## 📜 NPM Scripts Reference

### Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js development server |
| `npm run dev:setup` | Complete automated setup (recommended for first time) |
| `npm run dev:setup:quick` | Quick setup (skip seed, studio) |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |

### Database Scripts (Local Development)

| Script | Description |
|--------|-------------|
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Create and apply new migration |
| `npm run db:push` | Push schema changes without migration (dev only) |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run db:seed` | Seed database with test data |
| `npm run db:reset-local` | Reset database and re-seed (DELETES ALL DATA) |
| `npm run db:pull-schema` | Pull schema from production (structure only, no data) |
| `npm run db:check-safety` | Verify environment safety |

### Production Scripts

| Script | Description |
|--------|-------------|
| `npm run db:deploy:prod` | Deploy migrations to production |
| `npm run create-admin:prod` | Create admin user in production |

⚠️ **Warning:** Production scripts require `.env.production.local` and have safety checks.

### Build Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run vercel-build` | Build for Vercel deployment |

---

## 🔄 Common Workflows

### 1. Starting a New Feature

```bash
# Pull latest code
git pull origin main

# Ensure environment is up to date
npm install
npm run dev:setup:quick

# Start development
npm run dev
```

### 2. Resetting Your Local Database

```bash
# Full reset with fresh seed data
npm run db:reset-local

# You'll be prompted to confirm (type 'yes')
```

### 3. Syncing Schema from Production

When production schema changes and you want to update locally:

```bash
# Pull schema structure (no data)
npm run db:pull-schema

# Review changes in prisma/schema.prisma
# Then apply to local database:
npm run db:push
```

### 4. Creating a New Migration

```bash
# Make changes to prisma/schema.prisma

# Create and apply migration
npm run db:migrate

# Prisma will prompt for a migration name
# Example: "add_user_avatar_field"

# Commit the migration file
git add prisma/migrations/
git commit -m "Add user avatar field migration"
```

### 5. Testing with Fresh Data

```bash
# Reset database
npm run db:reset-local

# Or manually seed
npm run db:seed
```

### 6. Viewing Database Content

```bash
# Open Prisma Studio (visual database browser)
npm run db:studio

# Opens at http://localhost:5555
```

### 7. Checking Environment Safety

```bash
# Verify your environment is safe for destructive operations
npm run db:check-safety
```

---

## 🔒 Safety Features

### Built-in Safety Checks

All destructive operations (seed, reset, etc.) include safety checks:

1. **Environment Validation**
   - Checks `DEPLOYMENT_ENV` is set to `local`
   - Verifies `NODE_ENV` is `development`
   - Validates `DATABASE_URL` doesn't point to production

2. **Interactive Confirmation**
   - Prompts for "yes" confirmation before destructive operations
   - Shows what will be affected
   - Can be bypassed with `--force` flag (use carefully!)

3. **Production Protection**
   - Production scripts require explicit `.env.production.local` file
   - Use `dotenv-cli` to isolate production environment
   - Clear warnings for dangerous operations

### Safety Check Output Example

```
🔍 Environment Safety Check
============================================================

📊 Current Environment:
   NODE_ENV: development
   DEPLOYMENT_ENV: local
   Database Type: sqlite
   Database URL: file:./dev.db

============================================================
✅ Environment is SAFE for local development operations
```

### If Safety Check Fails

```
❌ SAFETY CHECK FAILED

This script cannot proceed because it would run against
a production or unsafe database.

To fix this:
  1. Ensure you have a .env.local file
  2. Set DEPLOYMENT_ENV='local'
  3. Use a local database:
     - SQLite: DATABASE_URL='file:./dev.db'
     - Local Postgres: DATABASE_URL='postgresql://user:pass@localhost:5432/dbname_dev'
```

---

## 🐛 Troubleshooting

### "DATABASE_URL is not set"

**Solution:**

```bash
# Run setup to create .env.local
npm run dev:setup

# Or manually create .env.local from template
cp .env.local.example .env.local
```

### "Prisma Client not generated"

**Solution:**

```bash
npm run db:generate
```

### "Migration failed" or "Schema out of sync"

**Solution:**

```bash
# For local dev, push changes without migration
npm run db:push

# Or reset and start fresh
npm run db:reset-local
```

### "Permission denied" on Windows

**Solution:**

```powershell
# Run terminal as Administrator
# Or check PowerShell execution policy:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "Port 3000 already in use"

**Solution:**

```bash
# Kill process on port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:3000 | xargs kill -9

# Or use a different port:
PORT=3001 npm run dev
```

### "Prisma Client validation failed"

**Solution:**

```bash
# Regenerate Prisma Client
npm run db:generate

# If still failing, clean install:
rm -rf node_modules
npm install
```

### Seed Script Fails with "Cannot confirm in non-interactive mode"

**Solution:**

```bash
# Use force flag to skip confirmation
npm run db:seed -- --force
```

---

## 🪟 Windows-Specific Notes

### File Paths

Use forward slashes `/` or escaped backslashes `\\` in `.env.local`:

```bash
# ✅ Good
DATABASE_URL="file:./dev.db"
DATABASE_URL="file:C:/Users/YourName/escalapp/dev.db"

# ❌ Bad
DATABASE_URL="file:C:\Users\YourName\escalapp\dev.db"
```

### PowerShell Scripts

The project includes PowerShell scripts for Windows users:

```powershell
# Backup from Neon to local PostgreSQL
.\scripts\backup-neon-to-local.ps1 -LocalConn "postgresql://user:pass@localhost:5432/dbname"
```

### Line Endings

If you encounter issues with line endings:

```bash
# Configure Git to handle line endings
git config --global core.autocrlf true
```

### PostgreSQL on Windows

After installing PostgreSQL:

1. Add to PATH (usually automatic)
2. Default installation: `C:\Program Files\PostgreSQL\17\bin`
3. Connection string: `postgresql://postgres:yourpassword@localhost:5432/dbname`

---

## 📚 Additional Resources

### Documentation Files

- `CLAUDE.md` - Project overview and architecture
- `PHASE1_IMPLEMENTATION_SUMMARY.md` - Performance improvements (Phase 1)
- `PHASE2_IMPLEMENTATION_SUMMARY.md` - Database optimizations (Phase 2)
- `PHASE2_SAFETY_REVIEW.md` - Production safety review
- `PERFORMANCE_UX_IMPROVEMENTS.md` - Comprehensive improvement roadmap

### Useful Links

- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Downloads](https://www.postgresql.org/download/)
- [Neon Dashboard](https://console.neon.tech/)

---

## 🎯 Best Practices

### Development Workflow

1. **Always pull latest before starting:**
   ```bash
   git pull origin main
   npm install
   ```

2. **Use feature branches:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Test locally before pushing:**
   ```bash
   npm run lint
   npm run type-check
   npm run build
   ```

4. **Keep your local database fresh:**
   ```bash
   # Reset weekly or when needed
   npm run db:reset-local
   ```

### Database Migrations

1. **Always create migrations for schema changes:**
   ```bash
   # Don't just push to production
   npm run db:migrate
   ```

2. **Test migrations locally first:**
   ```bash
   npm run db:reset-local
   # Verify everything works
   ```

3. **Commit migration files:**
   ```bash
   git add prisma/migrations/
   git commit -m "Add migration: description"
   ```

### Environment Variables

1. **Never commit `.env.local` or `.env.production.local`**
2. **Always use `DEPLOYMENT_ENV` for safety**
3. **Document new environment variables in `.env.local.example`**

---

## ❓ FAQ

### Q: Do I need to run `npm install` every time?

**A:** Only when:
- Pulling latest code with new dependencies
- Switching branches with different dependencies
- After updating `package.json`

### Q: What's the difference between `db:push` and `db:migrate`?

**A:**
- `db:push` - Quick schema sync (dev only, no migration file)
- `db:migrate` - Creates migration file (for production, version controlled)

**Use `db:push` for rapid prototyping, `db:migrate` for production changes.**

### Q: Can I use a different port than 3000?

**A:** Yes:

```bash
PORT=3001 npm run dev
```

Don't forget to update `NEXTAUTH_URL` in `.env.local`:

```bash
NEXTAUTH_URL="http://localhost:3001"
```

### Q: How do I update my local schema when production changes?

**A:**

```bash
# Pull schema structure from production
npm run db:pull-schema

# Review changes
git diff prisma/schema.prisma

# Apply to local database
npm run db:push
```

### Q: What if I accidentally run a command on production?

**A:**
- All destructive commands have safety checks
- They check `DEPLOYMENT_ENV` and `DATABASE_URL`
- You'll see warnings and need to confirm
- Production scripts require explicit `.env.production.local`

### Q: Can I skip the database seeding?

**A:** Yes:

```bash
npm run dev:setup -- --skip-seed
```

### Q: How do I add more test users?

**A:** Edit `prisma/seed.ts` and change `USERS_COUNT`:

```typescript
const USERS_COUNT = 40; // Change this number
```

Then run:

```bash
npm run db:reset-local
```

---

## 🤝 Contributing

When contributing to this project:

1. Follow the [development workflow](#development-workflow)
2. Test your changes locally
3. Run linting and type-checking
4. Create migrations for schema changes
5. Update documentation if needed

---

## 📞 Getting Help

If you're stuck:

1. Check this guide first
2. Look at [Troubleshooting](#troubleshooting)
3. Search existing issues on GitHub
4. Ask in the team chat
5. Create a new GitHub issue

---

**Happy coding! 🎉**

*Last updated: 2025-10-14*
