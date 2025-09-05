// lib/performance.ts - OPTIMIZACIONES CRÍTICAS DE PERFORMANCE

import { prisma } from './prisma';

// 1. CONSULTAS OPTIMIZADAS PARA RANKINGS
export class OptimizedQueries {
  
  /**
   * PROBLEMA: Tu query actual en /api/rankings hace múltiples joins anidados
   * SOLUCIÓN: Query optimizada con índices específicos
   */
  static async getRankingsOptimized(tournamentId: string, maxRounds?: number) {
    // Query optimizada que evita N+1 queries
    const rankingsData = await prisma.$queryRaw<Array<{
      playerId: string;
      playerName: string;
      totalPoints: number;
      roundsPlayed: number;
      averagePoints: number;
      lastPlayedRound: number;
    }>>`
      WITH player_stats AS (
        SELECT 
          tp.playerId,
          p.name as playerName,
          COALESCE(SUM(CASE WHEN gp.usedComodin = false THEN gp.points ELSE 0 END), 0) as totalPoints,
          COUNT(CASE WHEN gp.usedComodin = false THEN 1 END) as roundsPlayed,
          MAX(r.number) as lastPlayedRound
        FROM tournament_players tp
        LEFT JOIN players p ON tp.playerId = p.id
        LEFT JOIN group_players gp ON p.id = gp.playerId
        LEFT JOIN groups g ON gp.groupId = g.id
        LEFT JOIN rounds r ON g.roundId = r.id
        WHERE tp.tournamentId = ${tournamentId}
          AND r.isClosed = true
          ${maxRounds ? `AND r.number <= ${maxRounds}` : ''}
        GROUP BY tp.playerId, p.name
      )
      SELECT 
        playerId,
        playerName,
        totalPoints,
        roundsPlayed,
        CASE 
          WHEN roundsPlayed > 0 
          THEN ROUND(totalPoints::numeric / roundsPlayed::numeric, 2)
          ELSE 0 
        END as averagePoints,
        lastPlayedRound
      FROM player_stats
      ORDER BY averagePoints DESC, totalPoints DESC
    `;

    return rankingsData;
  }

  /**
   * PROBLEMA: validateRoundIntegrity hace muchas consultas separadas
   * SOLUCIÓN: Query unificada para validación de integridad
   */
  static async getRoundIntegrityData(roundId: string) {
    return await prisma.$queryRaw<Array<{
      roundId: string;
      roundNumber: number;
      isClosed: boolean;
      tournamentId: string;
      groupsCount: number;
      playersCount: number;
      matchesCount: number;
      completedMatches: number;
      incompleteMatches: number;
      playersWithComodin: number;
    }>>`
      SELECT 
        r.id as roundId,
        r.number as roundNumber,
        r.isClosed,
        r.tournamentId,
        COUNT(DISTINCT g.id) as groupsCount,
        COUNT(DISTINCT gp.id) as playersCount,
        COUNT(DISTINCT m.id) as matchesCount,
        COUNT(DISTINCT CASE WHEN m.isConfirmed = true THEN m.id END) as completedMatches,
        COUNT(DISTINCT CASE WHEN m.isConfirmed = false THEN m.id END) as incompleteMatches,
        COUNT(DISTINCT CASE WHEN gp.usedComodin = true THEN gp.id END) as playersWithComodin
      FROM rounds r
      LEFT JOIN groups g ON r.id = g.roundId
      LEFT JOIN group_players gp ON g.id = gp.groupId
      LEFT JOIN matches m ON g.id = m.groupId
      WHERE r.id = ${roundId}
      GROUP BY r.id, r.number, r.isClosed, r.tournamentId
    `;
  }

  /**
   * PROBLEMA: Las consultas de matches no están optimizadas
   * SOLUCIÓN: Query con paginación y filtros eficientes
   */
  static async getMatchesOptimized(
    roundId: string,
    options: {
      page?: number;
      limit?: number;
      status?: 'all' | 'pending' | 'completed';
      groupId?: string;
    } = {}
  ) {
    const { page = 1, limit = 50, status = 'all', groupId } = options;
    const offset = (page - 1) * limit;

    const whereConditions = [`g.roundId = '${roundId}'`];
    
    if (status === 'completed') {
      whereConditions.push('m.isConfirmed = true');
    } else if (status === 'pending') {
      whereConditions.push('m.isConfirmed = false');
    }
    
    if (groupId) {
      whereConditions.push(`g.id = '${groupId}'`);
    }

    const whereClause = whereConditions.join(' AND ');

    const [matches, totalCount] = await Promise.all([
      prisma.$queryRaw`
        SELECT 
          m.id,
          m.groupId,
          g.number as groupNumber,
          m.setNumber,
          m.isConfirmed,
          m.team1Player1Id,
          m.team1Player2Id,
          m.team2Player1Id,
          m.team2Player2Id,
          m.team1Games,
          m.team2Games,
          m.tiebreakScore,
          m.updatedAt,
          p1.name as team1Player1Name,
          p2.name as team1Player2Name,
          p3.name as team2Player1Name,
          p4.name as team2Player2Name
        FROM matches m
        JOIN groups g ON m.groupId = g.id
        LEFT JOIN players p1 ON m.team1Player1Id = p1.id
        LEFT JOIN players p2 ON m.team1Player2Id = p2.id
        LEFT JOIN players p3 ON m.team2Player1Id = p3.id
        LEFT JOIN players p4 ON m.team2Player2Id = p4.id
        WHERE ${whereClause}
        ORDER BY g.number, m.setNumber
        LIMIT ${limit} OFFSET ${offset}
      `,
      
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM matches m
        JOIN groups g ON m.groupId = g.id
        WHERE ${whereClause}
      `
    ]);

    return {
      matches,
      pagination: {
        page,
        limit,
        total: Number(totalCount[0].count),
        pages: Math.ceil(Number(totalCount[0].count) / limit)
      }
    };
  }
}

// 2. SISTEMA DE CACHÉ INTELIGENTE
export class CacheManager {
  private static cache = new Map<string, { 
    data: any; 
    expires: number; 
    hits: number;
    created: number;
  }>();

  static set(
    key: string, 
    data: any, 
    ttlSeconds: number = 300 // 5 minutos por defecto
  ): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000),
      hits: 0,
      created: Date.now()
    });
  }

  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    entry.hits++;
    return entry.data as T;
  }

  static invalidate(pattern: string): number {
    let deleted = 0;
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  static getStats(): {
    size: number;
    hitRate: number;
    entries: Array<{
      key: string;
      size: number;
      hits: number;
      age: number;
    }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: JSON.stringify(entry.data).length,
      hits: entry.hits,
      age: Date.now() - entry.created
    }));

    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
    const totalRequests = entries.length; // Simplificado

    return {
      size: this.cache.size,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      entries: entries.sort((a, b) => b.hits - a.hits)
    };
  }
}

// 3. DECORADOR PARA CACHÉ AUTOMÁTICO
export function withCache(
  keyFactory: (...args: any[]) => string,
  ttlSeconds: number = 300
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = keyFactory(...args);
      
      // Intentar obtener de caché
      const cached = CacheManager.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Ejecutar método original
      const result = await originalMethod.apply(this, args);
      
      // Guardar en caché
      CacheManager.set(cacheKey, result, ttlSeconds);
      
      return result;
    };

    return descriptor;
  };
}

// 4. ÍNDICES RECOMENDADOS PARA PRISMA
export const RECOMMENDED_INDEXES = `
-- Índices críticos para performance

-- Rankings: consulta más frecuente
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_group_players_tournament_stats 
ON group_players (playerId, points, usedComodin) 
WHERE usedComodin = false;

-- Integridad de rondas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rounds_tournament_status 
ON rounds (tournamentId, number, isClosed);

-- Matches por grupo y estado
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_group_status 
ON matches (groupId, isConfirmed, setNumber);

-- Búsqueda de jugadores en torneos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tournament_players_lookup 
ON tournament_players (tournamentId, playerId, joinedRound);

-- Grupos por ronda
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_groups_round_level 
ON groups (roundId, level, number);

-- Historial de streaks (para reportes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_streak_history_player_round 
ON streak_history (playerId, roundId, createdAt);

-- Performance de autenticación
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active 
ON users (email) WHERE password IS NOT NULL;

-- Consultas de matches con jugadores
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_players 
ON matches (team1Player1Id, team1Player2Id, team2Player1Id, team2Player2Id);
`;

// 5. MONITOR DE PERFORMANCE
export class PerformanceMonitor {
  private static metrics = {
    slowQueries: [] as Array<{ query: string; duration: number; timestamp: Date }>,
    avgResponseTime: 0,
    requestCount: 0,
    errorRate: 0
  };

  static measureQuery<T>(queryName: string, queryFn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    
    return queryFn()
      .then(result => {
        const duration = Date.now() - start;
        
        if (duration > 1000) { // Queries > 1 segundo son problemáticas
          this.metrics.slowQueries.push({
            query: queryName,
            duration,
            timestamp: new Date()
          });
          
          // Mantener solo las últimas 100 queries lentas
          if (this.metrics.slowQueries.length > 100) {
            this.metrics.slowQueries = this.metrics.slowQueries.slice(-100);
          }
        }
        
        return result;
      })
      .catch(error => {
        console.error(`Query ${queryName} failed after ${Date.now() - start}ms:`, error);
        throw error;
      });
  }

  static getHealthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      slowQueries: number;
      averageQueryTime: number;
      cacheHitRate: number;
      recommendations: string[];
    };
  } {
    const slowQueriesCount = this.metrics.slowQueries.length;
    const cacheStats = CacheManager.getStats();
    
    const recommendations: string[] = [];
    
    if (slowQueriesCount > 10) {
      recommendations.push(`${slowQueriesCount} queries lentas detectadas`);
    }
    
    if (cacheStats.hitRate < 0.5) {
      recommendations.push('Baja tasa de aciertos en caché - revisar estrategia');
    }
    
    if (cacheStats.size > 1000) {
      recommendations.push('Caché muy grande - considerar limpieza automática');
    }

    const status: 'healthy' | 'degraded' | 'unhealthy' = 
      slowQueriesCount > 20 ? 'unhealthy' :
      slowQueriesCount > 5 ? 'degraded' : 'healthy';

    return {
      status,
      metrics: {
        slowQueries: slowQueriesCount,
        averageQueryTime: this.metrics.slowQueries.length > 0 
          ? this.metrics.slowQueries.reduce((sum, q) => sum + q.duration, 0) / this.metrics.slowQueries.length 
          : 0,
        cacheHitRate: cacheStats.hitRate,
        recommendations
      }
    };
  }
}

// 6. EJEMPLO DE USO EN RANKINGS OPTIMIZADO
export class OptimizedRankingService {
  
  @withCache(
    (tournamentId: string, roundRef?: number) => `rankings:${tournamentId}:${roundRef || 'latest'}`,
    300 // 5 minutos de caché
  )
  static async getRankings(tournamentId: string, roundRef?: number) {
    return await PerformanceMonitor.measureQuery(
      'getRankings',
      () => OptimizedQueries.getRankingsOptimized(tournamentId, roundRef)
    );
  }

  // Invalidar caché cuando se actualiza una ronda
  static async onRoundClosed(tournamentId: string) {
    CacheManager.invalidate(`rankings:${tournamentId}`);
    CacheManager.invalidate(`round-integrity:${tournamentId}`);
  }
}