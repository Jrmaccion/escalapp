# Restore Local Database from Production

**Quick guide for restoring production data to your local development environment**

---

## 🎯 What This Does

This process **downloads all data** from your production database and restores it to your local database.

⚠️ **WARNING:** This will **DELETE all local data** and replace it with production data.

---

## 🚀 Quick Start (Recommended)

### Option 1: Using npm Script (Easiest)

```bash
npm run db:restore-from-prod
```

This will:
1. ✅ Check your environment is safe (not running on production)
2. ✅ Ask for confirmation (type 'yes')
3. ✅ Download production database to `backups/` folder
4. ✅ Restore to your local Docker database
5. ✅ Keep backup file for safety

---

## 📋 Prerequisites

### 1. PostgreSQL Tools Installed

You need `pg_dump` and `psql` commands available.

**Windows:**
- Download: https://www.postgresql.org/download/windows/
- Install PostgreSQL (you can skip the database server if you only want the tools)
- Add to PATH: `C:\Program Files\PostgreSQL\17\bin`

**Check if installed:**
```bash
pg_dump --version
psql --version
```

### 2. Production Credentials

Create `.env.production.local` with your production database URL:

```bash
# .env.production.local
DATABASE_URL="postgresql://user:password@ep-xxx.aws.neon.tech/neondb?sslmode=require"
```

⚠️ **Never commit this file to git!**

### 3. Docker Running

Make sure your local database is running:

```bash
docker-compose up -d
```

---

## 🔄 Step-by-Step Process

### Step 1: Start Docker Database

```bash
docker-compose up -d
```

Verify it's running:
```bash
docker ps | grep escalapp-postgres
```

### Step 2: Run Restore Command

```bash
npm run db:restore-from-prod
```

### Step 3: Confirm When Prompted

The script will show you:
- Production database URL (masked)
- Local database URL (masked)
- What will happen

Type `yes` to proceed.

### Step 4: Wait for Completion

The process will:
1. Download from production (may take a few minutes)
2. Save backup file locally
3. Reset local database
4. Restore production data

### Step 5: Verify

```bash
# Open Prisma Studio to verify data
npm run db:studio

# Or start your app
npm run dev
```

---

## 🔒 Safety Features

### Built-in Protections

1. **Environment Check**
   - Verifies you're in local development mode
   - Checks `DEPLOYMENT_ENV="local"`
   - Won't run on production database

2. **Confirmation Required**
   - Must type 'yes' to proceed
   - Shows what will be affected
   - Can bypass with `--force` (use carefully!)

3. **Backup Saved**
   - All backups saved in `backups/` folder
   - Timestamped filenames
   - Can restore from these backups later

4. **Docker Detection**
   - Automatically detects Docker setup
   - Uses correct restore method
   - Handles container communication

---

## 📂 Backup Files

Backups are saved in:
```
backups/
  ├── production_backup_2025-10-14_143022.sql
  ├── production_backup_2025-10-13_101543.sql
  └── ...
```

### Restore from a Backup File

If you want to restore from a specific backup file:

```bash
# For Docker
docker cp backups/production_backup_2025-10-14_143022.sql escalapp-postgres:/tmp/restore.sql
docker exec -i escalapp-postgres psql -U postgres -d escalapp -f /tmp/restore.sql

# For local PostgreSQL
psql "postgresql://postgres:admin@localhost:5432/escalapp" -f backups/production_backup_2025-10-14_143022.sql
```

---

## 🎛️ Advanced Usage

### Skip Confirmation (for scripts)

```bash
npm run db:restore-from-prod:force
```

⚠️ Use with caution - no confirmation prompt!

### Using PowerShell Script (Windows only)

If you prefer the PowerShell version:

```powershell
.\scripts\backup-neon-to-local.ps1 `
  -LocalConn "postgresql://postgres:admin@escalapp-postgres:5432/escalapp" `
  -BackupsDir ".\backups"
```

---

## 🔍 Comparison: Schema vs Full Restore

| Operation | Schema | Data | Use Case |
|-----------|--------|------|----------|
| **Pull Schema** | ✅ Yes | ❌ No | Get latest table structure |
| **Restore from Prod** | ✅ Yes | ✅ Yes | Get real production data |

### Pull Schema Only

```bash
# Just get the table structure, no data
npm run db:pull-schema
```

Use this when:
- You want latest schema changes
- You want to keep your test data
- You're debugging schema issues

### Restore Full Database

```bash
# Get structure + all data
npm run db:restore-from-prod
```

Use this when:
- You want real production data
- You're debugging data-related issues
- You want to test with actual data

---

## 🐛 Troubleshooting

### "pg_dump not found"

**Problem:** PostgreSQL tools not installed or not in PATH

**Solution:**
```bash
# Windows: Download and install
https://www.postgresql.org/download/windows/

# Then add to PATH:
C:\Program Files\PostgreSQL\17\bin
```

### "Cannot connect to production"

**Problem:** Production DATABASE_URL is incorrect

**Solution:**
1. Check `.env.production.local` exists
2. Verify DATABASE_URL is correct
3. Test connection manually:
   ```bash
   psql "your-production-url"
   ```

### "Cannot connect to local database"

**Problem:** Docker container not running

**Solution:**
```bash
# Start Docker
docker-compose up -d

# Check status
docker ps | grep escalapp-postgres

# Check logs
docker logs escalapp-postgres
```

### "Permission denied"

**Problem:** Docker container doesn't have file permissions

**Solution:**
The script handles this by copying files into the container. If it still fails:
```bash
# Give Docker permission to backups folder
chmod -R 755 backups/
```

### "Restore takes too long"

**Problem:** Large production database

**Solutions:**
1. **Wait it out** - Large databases take time (5-10 minutes for 100MB+)
2. **Use faster internet** - Production download is network-bound
3. **Restore from backup** - If you have a recent backup file, restore from that instead

---

## 📊 What Gets Restored

### ✅ What IS Restored

- All tables and their data
- Indexes (including Phase 2 optimizations)
- Constraints and foreign keys
- Sequences (auto-increment values)
- All user data
- All tournament data
- All matches, rankings, etc.

### ❌ What is NOT Restored

- Database users/roles (skipped with `--no-owner`)
- Permissions (skipped with `--no-privileges`)
- Postgres extensions (if any)

This is intentional - you keep your local database user configuration.

---

## ⚙️ How It Works

### Behind the Scenes

1. **Read Production URL**
   - From `.env.production.local`
   - Validates connection string
   - Adds SSL mode if needed (for Neon)

2. **Create Dump**
   - Uses `pg_dump` with plain SQL format
   - Includes structure and data
   - Saves to timestamped file

3. **Detect Local Setup**
   - Checks if Docker or direct PostgreSQL
   - Reads connection from `.env.local`
   - Prepares restore method

4. **Reset Local Database**
   - Drops `public` schema (deletes everything)
   - Recreates empty schema
   - Grants permissions

5. **Restore Data**
   - Docker: Copy file to container, run psql inside
   - Direct: Run psql with file
   - Reports progress

6. **Cleanup & Report**
   - Keeps backup file
   - Shows summary
   - Suggests next steps

---

## 🔐 Security Notes

### Production Credentials

- ✅ Store in `.env.production.local` (gitignored)
- ✅ Never commit to git
- ✅ Use read-only credentials if possible
- ✅ Rotate credentials regularly

### Local Backups

- ⚠️ Backup files contain **real production data**
- ⚠️ Keep backups secure
- ⚠️ Don't commit backups to git
- ⚠️ Clean up old backups regularly

```bash
# Clean up backups older than 7 days
# Windows PowerShell
Get-ChildItem -Path .\backups -Filter "*.sql" | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-7)} | Remove-Item
```

---

## 🎯 Common Workflows

### Workflow 1: Debug with Real Data

```bash
# 1. Restore production data
npm run db:restore-from-prod

# 2. Open Prisma Studio
npm run db:studio

# 3. Inspect the data
# 4. Start dev server
npm run dev
```

### Workflow 2: Test Migration with Real Data

```bash
# 1. Restore production data
npm run db:restore-from-prod

# 2. Make schema changes in prisma/schema.prisma

# 3. Test migration
npm run db:migrate

# 4. Verify everything works
npm run dev

# 5. If good, reset and commit migration
git add prisma/migrations/
git commit -m "Add migration: description"
```

### Workflow 3: Keep Fresh Production Snapshot

```bash
# Weekly: Get fresh production data
npm run db:restore-from-prod

# Work with real data all week
npm run dev

# Before next week, refresh again
```

---

## 📚 Related Commands

| Command | What it does |
|---------|-------------|
| `npm run db:restore-from-prod` | Full restore (structure + data) |
| `npm run db:pull-schema` | Structure only (no data) |
| `npm run db:reset-local` | Delete everything, reseed test data |
| `npm run db:studio` | View database in GUI |
| `npm run db:check-safety` | Verify environment safety |

---

## ❓ FAQ

### Q: How long does it take?

**A:** Depends on database size:
- Small (<10MB): 30 seconds
- Medium (10-100MB): 2-5 minutes
- Large (>100MB): 5-15 minutes

### Q: Will this affect production?

**A:** No! It only **reads** from production. Production is never modified.

### Q: Can I restore just one table?

**A:** Not with this script. You'd need to manually:
```bash
pg_dump --table=users "production-url" > users.sql
psql "local-url" -f users.sql
```

### Q: What if I want test data instead?

**A:** Use the seed script:
```bash
npm run db:reset-local
```

This creates fake test data instead of using production.

### Q: Can I schedule automatic restores?

**A:** Yes! Use cron (Linux/Mac) or Task Scheduler (Windows):

```bash
# Daily at 2 AM
0 2 * * * cd /path/to/escalapp && npm run db:restore-from-prod:force
```

⚠️ Make sure to use `--force` flag for unattended operation.

---

## 🆘 Need Help?

1. Check `DEV_SETUP_GUIDE.md` for general setup
2. Run `npm run db:check-safety` for diagnostics
3. Check Docker is running: `docker ps`
4. Verify `.env.production.local` exists and has correct URL
5. Test PostgreSQL tools: `pg_dump --version`

---

**Happy debugging with real data!** 🎉

*Last updated: 2025-10-14*
