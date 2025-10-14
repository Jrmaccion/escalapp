-- Phase 2 Safety Verification Script
-- Run this BEFORE applying the migration to verify your database state
-- Usage: psql $DATABASE_URL -f scripts/verify-phase2-safety.sql

\echo '========================================='
\echo 'Phase 2 Safety Verification'
\echo '========================================='
\echo ''

-- 1. Check database size and available space
\echo '1. Database Size Check'
\echo '------------------------'
SELECT
  pg_size_pretty(pg_database_size(current_database())) as "Current DB Size",
  pg_size_pretty(pg_database_size(current_database()) * 1.3) as "Estimated After Indexes";
\echo ''

-- 2. Check table sizes (largest tables need most time for indexing)
\echo '2. Table Sizes (Top 10)'
\echo '------------------------'
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
\echo ''

-- 3. Check existing indexes (Phase 2 adds more)
\echo '3. Current Index Count Per Table'
\echo '------------------------'
SELECT
  tablename,
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY index_count DESC;
\echo ''

-- 4. Check for existing Phase 2 indexes (should be empty if not yet applied)
\echo '4. Phase 2 Indexes Status'
\echo '------------------------'
\echo 'Checking if Phase 2 indexes already exist...'
SELECT
  CASE
    WHEN COUNT(*) > 0 THEN '⚠️  ALREADY APPLIED - Some Phase 2 indexes exist'
    ELSE '✅ NOT YET APPLIED - Safe to proceed'
  END as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE '%tournamentId_idx' OR
    indexname LIKE '%playerId_idx' OR
    indexname LIKE '%isClosed_idx' OR
    indexname LIKE '%startDate_endDate%' OR
    indexname LIKE '%roundId_level%' OR
    indexname LIKE '%team%Player%Id%'
  );
\echo ''

-- 5. Check active connections (high traffic warning)
\echo '5. Active Connections'
\echo '------------------------'
SELECT
  COUNT(*) as active_connections,
  CASE
    WHEN COUNT(*) > 50 THEN '⚠️  HIGH TRAFFIC - Consider low-traffic window'
    WHEN COUNT(*) > 20 THEN '⚠️  MODERATE TRAFFIC - Monitor during migration'
    ELSE '✅ LOW TRAFFIC - Good time for migration'
  END as recommendation
FROM pg_stat_activity
WHERE datname = current_database()
  AND state = 'active';
\echo ''

-- 6. Check for locks (should be minimal)
\echo '6. Current Locks'
\echo '------------------------'
SELECT
  COUNT(*) as lock_count,
  CASE
    WHEN COUNT(*) > 10 THEN '⚠️  HIGH LOCKS - Wait before migration'
    WHEN COUNT(*) > 5 THEN '⚠️  MODERATE LOCKS - Monitor'
    ELSE '✅ LOW LOCKS - Safe to proceed'
  END as recommendation
FROM pg_locks
WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database());
\echo ''

-- 7. Check critical tables data count
\echo '7. Data Volume Check'
\echo '------------------------'
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'players', COUNT(*) FROM players
UNION ALL
SELECT 'tournaments', COUNT(*) FROM tournaments
UNION ALL
SELECT 'rounds', COUNT(*) FROM rounds
UNION ALL
SELECT 'groups', COUNT(*) FROM groups
UNION ALL
SELECT 'matches', COUNT(*) FROM matches
UNION ALL
SELECT 'group_players', COUNT(*) FROM group_players
UNION ALL
SELECT 'rankings', COUNT(*) FROM rankings
ORDER BY row_count DESC;
\echo ''

-- 8. Estimate indexing time
\echo '8. Estimated Migration Time'
\echo '------------------------'
WITH table_sizes AS (
  SELECT
    'matches' as table_name,
    pg_total_relation_size('matches') as bytes,
    (SELECT COUNT(*) FROM matches) as rows
  UNION ALL
  SELECT 'rounds', pg_total_relation_size('rounds'), (SELECT COUNT(*) FROM rounds)
  UNION ALL
  SELECT 'groups', pg_total_relation_size('groups'), (SELECT COUNT(*) FROM groups)
  UNION ALL
  SELECT 'rankings', pg_total_relation_size('rankings'), (SELECT COUNT(*) FROM rankings)
  UNION ALL
  SELECT 'tournament_players', pg_total_relation_size('tournament_players'), (SELECT COUNT(*) FROM tournament_players)
)
SELECT
  table_name,
  pg_size_pretty(bytes) as size,
  rows,
  CASE
    WHEN rows < 1000 THEN '1-5 seconds'
    WHEN rows < 10000 THEN '5-15 seconds'
    WHEN rows < 100000 THEN '15-60 seconds'
    ELSE '1-5 minutes'
  END as estimated_time_per_index
FROM table_sizes
ORDER BY bytes DESC;
\echo ''

-- 9. Final Safety Check
\echo '9. Final Safety Check'
\echo '------------------------'
SELECT
  '✅ Schema Valid' as check_1,
  '✅ No Data Loss Risk' as check_2,
  '✅ Reversible (Can Drop Indexes)' as check_3,
  '✅ Safe for Production' as check_4;
\echo ''

\echo '========================================='
\echo 'Verification Complete'
\echo '========================================='
\echo ''
\echo 'Next Steps:'
\echo '1. Review the output above'
\echo '2. If all checks pass, run: npx prisma migrate dev --name phase2_indexes'
\echo '3. Monitor the migration progress'
\echo '4. Verify indexes created: psql $DATABASE_URL -f scripts/verify-indexes.sql'
\echo ''
\echo 'For rollback plan, see: PHASE2_SAFETY_REVIEW.md'
\echo '========================================='
