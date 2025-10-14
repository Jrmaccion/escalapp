-- Phase 2 Index Verification Script
-- Run this AFTER applying the migration to verify indexes were created
-- Usage: psql $DATABASE_URL -f scripts/verify-indexes.sql

\echo '========================================='
\echo 'Phase 2 Index Verification'
\echo '========================================='
\echo ''

-- 1. Check all Phase 2 indexes exist
\echo '1. Phase 2 Indexes Created'
\echo '------------------------'
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE '%tournamentId_idx%' OR
    indexname LIKE '%playerId_idx%' OR
    indexname LIKE '%isClosed_idx%' OR
    indexname LIKE '%startDate%' OR
    indexname LIKE '%endDate%' OR
    indexname LIKE '%roundId_idx%' OR
    indexname LIKE '%level%' OR
    indexname LIKE '%status_idx%' OR
    indexname LIKE '%isConfirmed%' OR
    indexname LIKE '%team%Player%'
  )
ORDER BY tablename, indexname;
\echo ''

-- 2. Count indexes per table
\echo '2. Index Count Per Table'
\echo '------------------------'
SELECT
  tablename,
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('matches', 'rounds', 'groups', 'rankings', 'tournament_players')
GROUP BY tablename
ORDER BY tablename;
\echo ''

-- 3. Test index usage (run sample queries)
\echo '3. Testing Index Usage'
\echo '------------------------'
\echo 'Running EXPLAIN on sample queries to verify index usage...'
\echo ''

-- Test Match player indexes
\echo 'Query 1: Find matches by player (should use Index Scan)'
EXPLAIN (FORMAT TEXT, COSTS OFF)
SELECT * FROM matches
WHERE "team1Player1Id" = (SELECT id FROM players LIMIT 1);
\echo ''

-- Test Round tournament + closed index
\echo 'Query 2: Find open rounds (should use Index Scan)'
EXPLAIN (FORMAT TEXT, COSTS OFF)
SELECT * FROM rounds
WHERE "tournamentId" = (SELECT id FROM tournaments LIMIT 1)
  AND "isClosed" = false;
\echo ''

-- Test Group roundId + level index
\echo 'Query 3: Find groups by level (should use Index Scan)'
EXPLAIN (FORMAT TEXT, COSTS OFF)
SELECT * FROM groups
WHERE "roundId" = (SELECT id FROM rounds LIMIT 1)
  AND level = 1;
\echo ''

-- Test Ranking composite index
\echo 'Query 4: Find rankings (should use Index Scan)'
EXPLAIN (FORMAT TEXT, COSTS OFF)
SELECT * FROM rankings
WHERE "tournamentId" = (SELECT id FROM tournaments LIMIT 1)
  AND "roundNumber" = 1;
\echo ''

-- 4. Check index sizes
\echo '4. Index Sizes'
\echo '------------------------'
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('matches', 'rounds', 'groups', 'rankings', 'tournament_players')
ORDER BY pg_relation_size(indexname::regclass) DESC;
\echo ''

-- 5. Check index health
\echo '5. Index Health Check'
\echo '------------------------'
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  CASE
    WHEN idx_scan = 0 THEN '⚠️  Not yet used'
    WHEN idx_scan < 10 THEN '✅ Warming up'
    ELSE '✅ Actively used'
  END as status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('matches', 'rounds', 'groups', 'rankings', 'tournament_players')
ORDER BY idx_scan DESC;
\echo ''

-- 6. Summary
\echo '6. Summary'
\echo '------------------------'
WITH phase2_indexes AS (
  SELECT COUNT(*) as created_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND (
      indexname LIKE '%tournamentId_idx%' OR
      indexname LIKE '%playerId_idx%' OR
      indexname LIKE '%isClosed_idx%' OR
      indexname LIKE '%startDate%' OR
      indexname LIKE '%roundId_idx%' OR
      indexname LIKE '%level%' OR
      indexname LIKE '%status_idx%' OR
      indexname LIKE '%isConfirmed%' OR
      indexname LIKE '%team%Player%'
    )
)
SELECT
  created_count,
  CASE
    WHEN created_count >= 15 THEN '✅ Phase 2 indexes successfully created'
    WHEN created_count > 0 THEN '⚠️  Partial - some indexes may be missing'
    ELSE '❌ No Phase 2 indexes found - migration may have failed'
  END as status
FROM phase2_indexes;
\echo ''

\echo '========================================='
\echo 'Verification Complete'
\echo '========================================='
\echo ''
\echo 'Expected: 15-20 Phase 2 indexes created'
\echo 'If indexes are missing, check migration logs for errors'
\echo 'If indexes show "Not yet used", wait for queries to run'
\echo ''
