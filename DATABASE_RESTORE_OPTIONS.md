# Database Restore Options - Quick Reference

**Three ways to work with database data in Escalapp**

---

## 🎯 Choose Your Method

| Method | Schema | Data | Speed | Use Case |
|--------|--------|------|-------|----------|
| **Test Data** | ✅ | 🧪 Fake | Fast | Daily development |
| **Schema Only** | ✅ | ❌ | Fast | Schema updates |
| **Full Restore** | ✅ | 📊 Real | Slow | Debug with real data |

---

## Option 1: Test Data (Recommended for Daily Dev)

### What It Does
- Creates fresh database
- Generates fake test data
- 40 users, 2 tournaments, matches, rankings

### Command
```bash
npm run db:reset-local
```

### When to Use
- ✅ Daily development
- ✅ Testing new features
- ✅ Need clean slate
- ✅ Don't need real data

### Pros & Cons
✅ Fast (30 seconds)
✅ Predictable data
✅ No production credentials needed
❌ Fake data only
❌ May miss edge cases

---

## Option 2: Schema Only (Pull Structure)

### What It Does
- Downloads production schema (tables, columns, indexes)
- Does NOT download data
- Updates `prisma/schema.prisma`

### Command
```bash
npm run db:pull-schema
```

### When to Use
- ✅ Production schema changed
- ✅ Want to stay in sync
- ✅ Keep your test data
- ✅ Debug schema issues

### Pros & Cons
✅ Very fast (10 seconds)
✅ Read-only (safe)
✅ Keeps local data
❌ No real data
❌ Doesn't update database directly (need to run `db:push` after)

---

## Option 3: Full Restore (Structure + Data)

### What It Does
- Downloads complete production database
- Schema + all data
- Saves backup locally
- Replaces local database

### Command
```bash
npm run db:restore-from-prod
```

### When to Use
- ✅ Need real production data
- ✅ Debug data-specific issues
- ✅ Test with actual users/tournaments
- ✅ Reproduce production bugs

### Pros & Cons
✅ Real production data
✅ Exact replica
✅ Best for debugging
❌ Slow (2-10 minutes)
❌ Requires production credentials
❌ Contains sensitive data (be careful!)

---

## 🔄 Common Workflows

### Workflow 1: New Feature Development

```bash
# Start fresh
npm run db:reset-local

# Develop with test data
npm run dev
```

**Use:** Test Data

---

### Workflow 2: Schema Changed in Production

```bash
# Pull latest schema
npm run db:pull-schema

# Apply to local database
npm run db:push

# Keep working with test data
npm run dev
```

**Use:** Schema Only

---

### Workflow 3: Debugging Production Issue

```bash
# Get real production data
npm run db:restore-from-prod

# Debug with actual data
npm run dev

# View data
npm run db:studio
```

**Use:** Full Restore

---

### Workflow 4: Weekly Refresh

```bash
# Monday: Get fresh production data
npm run db:restore-from-prod

# Work all week with real data
npm run dev

# Friday: Clean up and prepare for next week
npm run db:reset-local
```

**Use:** Full Restore → Test Data

---

## 📊 Decision Tree

```
Need database changes?
│
├─ Just want latest table structure?
│  └─ npm run db:pull-schema  ← Schema Only
│
├─ Need fresh start with fake data?
│  └─ npm run db:reset-local  ← Test Data
│
└─ Need real production data?
   └─ npm run db:restore-from-prod  ← Full Restore
```

---

## 🔒 Safety Comparison

| Method | Affects Production | Deletes Local | Requires Credentials |
|--------|-------------------|---------------|---------------------|
| Test Data | ❌ No | ✅ Yes | ❌ No |
| Schema Only | ❌ No | ❌ No | ✅ Yes |
| Full Restore | ❌ No | ✅ Yes | ✅ Yes |

**All methods are safe** - none modify production!

---

## 🚀 Quick Commands

### Daily Development
```bash
docker-compose up -d  # Start database
npm run dev           # Start app
```

### Reset to Fresh Data
```bash
npm run db:reset-local
```

### Get Latest Schema
```bash
npm run db:pull-schema
npm run db:push
```

### Get Production Data
```bash
npm run db:restore-from-prod
```

### View Database
```bash
npm run db:studio
```

---

## 📁 Where Files Are Saved

### Test Data
No files - data generated on the fly

### Schema Only
- Backup: `prisma/schema.prisma.backup`
- Updated: `prisma/schema.prisma`

### Full Restore
- Backups: `backups/production_backup_YYYY-MM-DD_HHMMSS.sql`
- Kept indefinitely (clean up manually)

---

## ⚡ Speed Comparison

| Method | Time | Network | Disk Space |
|--------|------|---------|------------|
| Test Data | 30 sec | None | None |
| Schema Only | 10 sec | Minimal | ~50 KB |
| Full Restore | 2-10 min | Heavy | 10-500 MB |

*Times vary based on database size and internet speed*

---

## 🎓 Detailed Guides

- **Full guide:** `DEV_SETUP_GUIDE.md`
- **Restore details:** `RESTORE_FROM_PRODUCTION.md`
- **Safety info:** `SETUP_COMPLETE.md`

---

## 💡 Pro Tips

### Tip 1: Keep Backups
Full restore saves backups in `backups/` folder. These are handy:
```bash
# Restore from specific backup
psql "local-url" -f backups/production_backup_2025-10-14.sql
```

### Tip 2: Combine Methods
```bash
# Get schema from production
npm run db:pull-schema
npm run db:push

# But use test data
npm run db:seed
```

### Tip 3: Automation
```bash
# Skip confirmation (for scripts)
npm run db:restore-from-prod:force
npm run db:pull-schema:force
```

### Tip 4: Check Before You Change
```bash
# Always verify environment first
npm run db:check-safety
```

---

## ❓ FAQ

### Q: Which method should I use daily?

**A:** Test Data (`npm run db:reset-local`)
- Fast, predictable, safe

### Q: When do I need production data?

**A:** Only when:
- Debugging production-specific issues
- Testing with real user patterns
- Reproducing reported bugs

### Q: How often should I sync schema?

**A:** Whenever you:
- Pull latest code with schema changes
- Notice schema differences
- Get "out of sync" errors

### Q: Is it safe to run these commands?

**A:** Yes! All have built-in safety checks:
- Verify local environment
- Ask for confirmation
- Never modify production
- Clear error messages

---

**Quick Reference:**

```bash
# Test data (daily use)
npm run db:reset-local

# Schema sync (after git pull)
npm run db:pull-schema && npm run db:push

# Production data (debugging)
npm run db:restore-from-prod

# View database
npm run db:studio

# Check safety
npm run db:check-safety
```

---

*Last updated: 2025-10-14*
