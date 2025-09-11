// lib/performance.optimized.ts - Queries optimizadas para endpoints pesados
import { prisma } from "@/lib/prisma";

// ==============================
// RANKINGS OPTIMIZADOS
// ==============================

/**
 * Obtiene rankings oficial e ironman con una sola query optimizada
 * Evita N+1 y multiple joins usando CTEs
 */
export async function getOptimizedRankings(tournamentId: string) {
  // CTE para calcular estadísticas por jugador
  const rawQuery = `
    WITH player_stats AS (
      SELECT 
        tp.playerId,
        p.name as playerName,
        COUNT(DISTINCT CASE WHEN gp.usedComodin = false THEN r.id END) as roundsPlayed,
        SUM(gp.points) as totalPoints,
        CASE 
          WHEN COUNT(DISTINCT CASE WHEN gp.usedComodin = false THEN r.id END) > 0 
          THEN SUM(gp.points) / COUNT(DISTINCT CASE WHEN gp.usedComodin = false THEN r.id END)
          ELSE 0 
        END as averagePoints,
        tp.comodinesUsed,
        tp.substituteAppearances
      FROM tournament_players tp
      JOIN players p ON p.id = tp.playerId
      LEFT JOIN group_players gp ON gp.playerId = tp.playerId
      LEFT JOIN groups g ON g.id = gp.groupId
      LEFT JOIN rounds r ON r.id = g.roundId AND r.tournamentId = tp.tournamentId
      WHERE tp.tournamentId = $1
      GROUP BY tp.playerId, p.name, tp.comodinesUsed, tp.substituteAppearances
    ),
    ranked_official AS (
      SELECT 
        *,
        ROW_NUMBER() OVER (ORDER BY averagePoints DESC, totalPoints DESC, playerName) as officialPosition
      FROM player_stats
      WHERE roundsPlayed > 0
    ),
    ranked_ironman AS (
      SELECT 
        *,
        ROW_NUMBER() OVER (ORDER BY totalPoints DESC, averagePoints DESC, playerName) as ironmanPosition
      FROM player_stats
    )
    SELECT 
      ro.playerId,
      ro.playerName,
      ro.roundsPlayed,
      ro.totalPoints,
      ro.averagePoints,
      ro.comodinesUsed,
      ro.substituteAppearances,
      ro.officialPosition,
      COALESCE(ri.ironmanPosition, 999) as ironmanPosition
    FROM ranked_official ro
    LEFT JOIN ranked_ironman ri ON ri.playerId = ro.playerId
    ORDER BY ro.officialPosition;
  `;

  const results = await prisma.$queryRawUnsafe(rawQuery, tournamentId);
  return results as Array<{
    playerId: string;
    playerName: string;
    roundsPlayed: number;
    totalPoints: number;
    averagePoints: number;
    comodinesUsed: number;
    substituteAppearances: number;
    officialPosition: number;
    ironmanPosition: number;
  }>;
}

/**
 * Dashboard de jugador optimizado - una sola query
 */
export async function getOptimizedPlayerDashboard(playerId: string, tournamentId: string) {
  const rawQuery = `
    WITH player_rounds AS (
      SELECT 
        r.id as roundId,
        r.number as roundNumber,
        r.startDate,
        r.endDate,
        r.isClosed,
        g.id as groupId,
        g.number as groupNumber,
        g.level as groupLevel,
        gp.position,
        gp.points,
        gp.usedComodin,
        gp.comodinReason,
        gp.substitutePlayerId,
        CASE 
          WHEN gp.substitutePlayerId IS NOT NULL THEN 'substitute'
          WHEN gp.usedComodin = true THEN 'mean'
          ELSE NULL
        END as comodinMode
      FROM rounds r
      LEFT JOIN groups g ON g.roundId = r.id
      LEFT JOIN group_players gp ON gp.groupId = g.id AND gp.playerId = $1
      WHERE r.tournamentId = $2
      ORDER BY r.number DESC
    ),
    current_round AS (
      SELECT * FROM player_rounds WHERE isClosed = false LIMIT 1
    ),
    recent_rounds AS (
      SELECT * FROM player_rounds WHERE isClosed = true ORDER BY roundNumber DESC LIMIT 5
    ),
    player_totals AS (
      SELECT 
        COUNT(DISTINCT CASE WHEN usedComodin = false THEN roundId END) as totalRoundsPlayed,
        SUM(points) as totalPoints,
        COUNT(CASE WHEN usedComodin = true THEN 1 END) as comodinesUsed
      FROM player_rounds
      WHERE points IS NOT NULL
    )
    SELECT 
      'current' as section,
      cr.*,
      NULL::bigint as totalRoundsPlayed,
      NULL::decimal as totalPoints,
      NULL::bigint as comodinesUsed
    FROM current_round cr
    UNION ALL
    SELECT 
      'recent' as section,
      rr.*,
      NULL::bigint as totalRoundsPlayed,
      NULL::decimal as totalPoints,
      NULL::bigint as comodinesUsed
    FROM recent_rounds rr
    UNION ALL
    SELECT 
      'totals' as section,
      NULL::text as roundId,
      NULL::integer as roundNumber,
      NULL::timestamp as startDate,
      NULL::timestamp as endDate,
      NULL::boolean as isClosed,
      NULL::text as groupId,
      NULL::integer as groupNumber,
      NULL::integer as groupLevel,
      NULL::integer as position,
      NULL::decimal as points,
      NULL::boolean as usedComodin,
      NULL::text as comodinReason,
      NULL::text as substitutePlayerId,
      NULL::text as comodinMode,
      pt.totalRoundsPlayed,
      pt.totalPoints,
      pt.comodinesUsed
    FROM player_totals pt;
  `;

  const results = await prisma.$queryRawUnsafe(rawQuery, playerId, tournamentId);
  return results as Array<{
    section: 'current' | 'recent' | 'totals';
    roundId?: string;
    roundNumber?: number;
    startDate?: Date;
    endDate?: Date;
    isClosed?: boolean;
    groupId?: string;
    groupNumber?: number;
    groupLevel?: number;
    position?: number;
    points?: number;
    usedComodin?: boolean;
    comodinReason?: string;
    substitutePlayerId?: string;
    comodinMode?: string;
    totalRoundsPlayed?: number;
    totalPoints?: number;
    comodinesUsed?: number;
  }>;
}

/**
 * Admin dashboard optimizado con estadísticas agregadas
 */
export async function getOptimizedAdminStats(tournamentId: string) {
  const rawQuery = `
    WITH round_stats AS (
      SELECT 
        r.id as roundId,
        r.number as roundNumber,
        r.isClosed,
        COUNT(DISTINCT g.id) as groupsCount,
        COUNT(DISTINCT m.id) as matchesCount,
        COUNT(CASE WHEN m.isConfirmed = false THEN 1 END) as pendingMatches,
        COUNT(CASE WHEN m.isConfirmed = true THEN 1 END) as confirmedMatches
      FROM rounds r
      LEFT JOIN groups g ON g.roundId = r.id
      LEFT JOIN matches m ON m.groupId = g.id
      WHERE r.tournamentId = $1
      GROUP BY r.id, r.number, r.isClosed
    ),
    comodin_stats AS (
      SELECT 
        COUNT(CASE WHEN gp.usedComodin = true THEN 1 END) as comodinesUsados,
        COUNT(CASE WHEN gp.substitutePlayerId IS NOT NULL THEN 1 END) as suplentesActivos,
        COUNT(CASE WHEN gp.usedComodin = true AND gp.substitutePlayerId IS NULL THEN 1 END) as mediaUsados
      FROM group_players gp
      JOIN groups g ON g.id = gp.groupId
      JOIN rounds r ON r.id = g.roundId
      WHERE r.tournamentId = $1 AND r.isClosed = false
    ),
    player_count AS (
      SELECT COUNT(DISTINCT tp.playerId) as totalPlayers
      FROM tournament_players tp
      WHERE tp.tournamentId = $1
    )
    SELECT 
      rs.roundId,
      rs.roundNumber,
      rs.isClosed,
      rs.groupsCount,
      rs.matchesCount,
      rs.pendingMatches,
      rs.confirmedMatches,
      cs.comodinesUsados,
      cs.suplentesActivos,
      cs.mediaUsados,
      pc.totalPlayers
    FROM round_stats rs
    CROSS JOIN comodin_stats cs
    CROSS JOIN player_count pc
    ORDER BY rs.roundNumber DESC;
  `;

  const results = await prisma.$queryRawUnsafe(rawQuery, tournamentId);
  return results as Array<{
    roundId: string;
    roundNumber: number;
    isClosed: boolean;
    groupsCount: number;
    matchesCount: number;
    pendingMatches: number;
    confirmedMatches: number;
    comodinesUsados: number;
    suplentesActivos: number;
    mediaUsados: number;
    totalPlayers: number;
  }>;
}

/**
 * Historial de jugador optimizado con timeline
 */
export async function getOptimizedPlayerHistory(playerId: string, tournamentId: string) {
  const rawQuery = `
    WITH round_history AS (
      SELECT 
        r.id as roundId,
        r.number as roundNumber,
        r.startDate,
        r.endDate,
        r.isClosed,
        g.number as groupNumber,
        g.level as groupLevel,
        gp.position,
        gp.points,
        gp.usedComodin,
        gp.comodinReason,
        -- Calcular movimiento comparando con ronda anterior
        LAG(g.level) OVER (ORDER BY r.number) as previousGroupLevel,
        LAG(gp.position) OVER (ORDER BY r.number) as previousPosition,
        -- Calcular media móvil de últimas 3 rondas
        AVG(gp.points) OVER (
          ORDER BY r.number 
          ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) as movingAverage,
        -- Partidos de la ronda
        COUNT(DISTINCT m.id) as matchesPlayed,
        COUNT(CASE WHEN m.isConfirmed = true THEN 1 END) as matchesConfirmed
      FROM rounds r
      LEFT JOIN groups g ON g.roundId = r.id
      LEFT JOIN group_players gp ON gp.groupId = g.id AND gp.playerId = $1
      LEFT JOIN matches m ON m.groupId = g.id AND (
        m.team1Player1Id = $1 OR m.team1Player2Id = $1 OR
        m.team2Player1Id = $1 OR m.team2Player2Id = $1
      )
      WHERE r.tournamentId = $2
      GROUP BY r.id, r.number, r.startDate, r.endDate, r.isClosed,
               g.number, g.level, gp.position, gp.points, gp.usedComodin, gp.comodinReason
      ORDER BY r.number DESC
    )
    SELECT 
      *,
      CASE 
        WHEN previousGroupLevel IS NULL THEN 'new'
        WHEN groupLevel < previousGroupLevel THEN 'up'
        WHEN groupLevel > previousGroupLevel THEN 'down'
        ELSE 'same'
      END as movement
    FROM round_history;
  `;

  const results = await prisma.$queryRawUnsafe(rawQuery, playerId, tournamentId);
  return results as Array<{
    roundId: string;
    roundNumber: number;
    startDate: Date;
    endDate: Date;
    isClosed: boolean;
    groupNumber: number;
    groupLevel: number;
    position: number;
    points: number;
    usedComodin: boolean;
    comodinReason: string;
    previousGroupLevel: number;
    previousPosition: number;
    movingAverage: number;
    matchesPlayed: number;
    matchesConfirmed: number;
    movement: 'new' | 'up' | 'down' | 'same';
  }>;
}

/**
 * Función helper para cachear queries pesadas
 */
export function createQueryCache<T>(ttlMinutes: number = 5) {
  const cache = new Map<string, { data: T; expires: number }>();
  
  return {
    get: (key: string): T | null => {
      const cached = cache.get(key);
      if (cached && Date.now() < cached.expires) {
        return cached.data;
      }
      cache.delete(key);
      return null;
    },
    
    set: (key: string, data: T): void => {
      cache.set(key, {
        data,
        expires: Date.now() + (ttlMinutes * 60 * 1000)
      });
    },
    
    clear: (): void => {
      cache.clear();
    }
  };
}

// Cache para rankings (se actualiza cada 5 minutos)
export const rankingsCache = createQueryCache<any>(5);

// Cache para dashboard (se actualiza cada 2 minutos)  
export const dashboardCache = createQueryCache<any>(2);