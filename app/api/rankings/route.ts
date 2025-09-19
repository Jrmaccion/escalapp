// app/api/rankings/route.ts - UNIFICADO CON DESEMPATES
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// Query unificada para rankings con desempates
async function getUnifiedRankings(tournamentId: string, roundNumber?: number) {
  const roundFilter = roundNumber ? `AND r."number" = ${roundNumber}` : '';
  
  const playersStats = await prisma.$queryRaw<any[]>`
    SELECT 
      p.id as "playerId",
      p.name as "playerName",
      u.name as "userName",
      COALESCE(SUM(gp.points), 0) as "totalPoints",
      COUNT(CASE WHEN gp."usedComodin" = false THEN 1 END) as "roundsPlayed",
      CASE 
        WHEN COUNT(CASE WHEN gp."usedComodin" = false THEN 1 END) > 0 
        THEN COALESCE(SUM(gp.points) / COUNT(CASE WHEN gp."usedComodin" = false THEN 1 END), 0)
        ELSE 0 
      END as "averagePoints",
      -- Estadísticas para desempates
      COALESCE(SUM(
        CASE 
          WHEN m.team1Player1Id = p.id OR m.team1Player2Id = p.id 
          THEN CASE WHEN m.team1Games > m.team2Games THEN 1 ELSE 0 END
          WHEN m.team2Player1Id = p.id OR m.team2Player2Id = p.id 
          THEN CASE WHEN m.team2Games > m.team1Games THEN 1 ELSE 0 END
          ELSE 0
        END
      ), 0) as "setsWon",
      COALESCE(SUM(
        CASE 
          WHEN m.team1Player1Id = p.id OR m.team1Player2Id = p.id 
          THEN m.team1Games - m.team2Games
          WHEN m.team2Player1Id = p.id OR m.team2Player2Id = p.id 
          THEN m.team2Games - m.team1Games
          ELSE 0
        END
      ), 0) as "gamesDifference",
      COALESCE(SUM(
        CASE 
          WHEN m.team1Player1Id = p.id OR m.team1Player2Id = p.id THEN m.team1Games
          WHEN m.team2Player1Id = p.id OR m.team2Player2Id = p.id THEN m.team2Games
          ELSE 0
        END
      ), 0) as "gamesWon",
      -- H2H wins (aproximado como sets ganados para simplificar)
      COALESCE(SUM(
        CASE 
          WHEN m.team1Player1Id = p.id OR m.team1Player2Id = p.id 
          THEN CASE WHEN m.team1Games > m.team2Games THEN 1 ELSE 0 END
          WHEN m.team2Player1Id = p.id OR m.team2Player2Id = p.id 
          THEN CASE WHEN m.team2Games > m.team1Games THEN 1 ELSE 0 END
          ELSE 0
        END
      ), 0) as "h2hWins",
      -- Estadísticas adicionales
      COUNT(CASE WHEN gp."usedComodin" = true THEN 1 END) as "comodinesUsed",
      MAX(gp.streak) as "maxStreak",
      -- Información de grupo actual
      (
        SELECT CONCAT(g2.number, '-', gp2.position)
        FROM "group_players" gp2
        INNER JOIN "groups" g2 ON gp2."groupId" = g2.id
        INNER JOIN "rounds" r2 ON g2."roundId" = r2.id
        WHERE gp2."playerId" = p.id 
          AND r2."tournamentId" = ${`'${tournamentId}'`}
          AND r2."isClosed" = false
        LIMIT 1
      ) as "currentGroupPosition"
    FROM "players" p
    INNER JOIN "users" u ON p."userId" = u.id
    LEFT JOIN "group_players" gp ON p.id = gp."playerId"
    LEFT JOIN "groups" g ON gp."groupId" = g.id
    LEFT JOIN "rounds" r ON g."roundId" = r.id
    LEFT JOIN "matches" m ON g.id = m."groupId" AND m."isConfirmed" = true
    WHERE r."tournamentId" = ${`'${tournamentId}'`}
      AND r."isClosed" = true
      ${roundFilter}
    GROUP BY p.id, p.name, u.name
  `;

  return playersStats;
}

// Función de ordenamiento unificada para diferentes tipos de ranking
function sortPlayersForRanking(players: any[], rankingType: 'official' | 'ironman') {
  return [...players].sort((a, b) => {
    if (rankingType === 'official') {
      // Ranking oficial: promedio como criterio principal
      if (a.averagePoints !== b.averagePoints) return b.averagePoints - a.averagePoints;
    } else {
      // Ranking ironman: puntos totales como criterio principal
      if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
    }
    
    // Criterios de desempate comunes
    if (a.setsWon !== b.setsWon) return b.setsWon - a.setsWon;
    if (a.gamesDifference !== b.gamesDifference) return b.gamesDifference - a.gamesDifference;
    if (a.h2hWins !== b.h2hWins) return b.h2hWins - a.h2hWins;
    if (a.gamesWon !== b.gamesWon) return b.gamesWon - a.gamesWon;
    
    return 0;
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');
    const type = searchParams.get('type') as 'official' | 'ironman' | 'both' || 'both';
    const roundNumber = searchParams.get('round');

    if (!tournamentId) {
      return NextResponse.json({ error: "tournamentId requerido" }, { status: 400 });
    }

    // Verificar acceso si hay sesión
    const session = await getServerSession(authOptions);
    let isAdmin = false;
    let isParticipant = false;

    if (session?.user?.id) {
      isAdmin = session.user.isAdmin || false;
      
      // Verificar si es participante
      const player = await prisma.player.findUnique({
        where: { userId: session.user.id },
        select: { id: true }
      });

      if (player) {
        const participation = await prisma.tournamentPlayer.findFirst({
          where: {
            tournamentId,
            playerId: player.id
          }
        });
        isParticipant = !!participation;
      }
    }

    // Obtener datos del torneo
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        title: true,
        isPublic: true,
        totalRounds: true,
        rounds: {
          select: { number: true, isClosed: true },
          orderBy: { number: 'desc' },
          take: 1
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    // Verificar acceso
    if (!tournament.isPublic && !isAdmin && !isParticipant) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener estadísticas unificadas
    const playersStats = await getUnifiedRankings(
      tournamentId, 
      roundNumber ? parseInt(roundNumber) : undefined
    );

    // Convertir BigInt a Number
    const normalizedStats = playersStats.map(player => ({
      playerId: player.playerId,
      playerName: player.playerName,
      userName: player.userName,
      totalPoints: Number(player.totalPoints),
      roundsPlayed: Number(player.roundsPlayed),
      averagePoints: Number(player.averagePoints),
      setsWon: Number(player.setsWon),
      gamesDifference: Number(player.gamesDifference),
      gamesWon: Number(player.gamesWon),
      h2hWins: Number(player.h2hWins),
      comodinesUsed: Number(player.comodinesUsed),
      maxStreak: Number(player.maxStreak),
      currentGroupPosition: player.currentGroupPosition
    }));

    // Crear rankings
    const rankings: any = {};

    if (type === 'official' || type === 'both') {
      const officialRanking = sortPlayersForRanking(normalizedStats, 'official');
      rankings.official = officialRanking.map((player, index) => ({
        position: index + 1,
        ...player,
        isEligible: player.roundsPlayed >= Math.ceil(tournament.totalRounds * 0.5), // 50% mínimo
        movement: index === 0 ? 'champion' : index < 3 ? 'podium' : 'stable'
      }));
    }

    if (type === 'ironman' || type === 'both') {
      const ironmanRanking = sortPlayersForRanking(normalizedStats, 'ironman');
      rankings.ironman = ironmanRanking.map((player, index) => ({
        position: index + 1,
        ...player,
        movement: 'ironman'
      }));
    }

    // Estadísticas generales
    const stats = {
      totalPlayers: normalizedStats.length,
      eligiblePlayers: normalizedStats.filter(p => 
        p.roundsPlayed >= Math.ceil(tournament.totalRounds * 0.5)
      ).length,
      completedRounds: tournament.rounds[0]?.isClosed ? tournament.rounds[0].number : 0,
      totalRounds: tournament.totalRounds,
      averageParticipation: normalizedStats.length > 0 
        ? Math.round(normalizedStats.reduce((sum, p) => sum + p.roundsPlayed, 0) / normalizedStats.length * 10) / 10
        : 0
    };

    return NextResponse.json({
      success: true,
      tournament: {
        id: tournament.id,
        title: tournament.title,
        isPublic: tournament.isPublic
      },
      rankings,
      stats,
      tiebreakCriteria: {
        official: [
          "Promedio de puntos por ronda",
          "Sets ganados",
          "Diferencia de juegos", 
          "Head-to-head wins",
          "Juegos ganados totales"
        ],
        ironman: [
          "Puntos totales acumulados",
          "Sets ganados",
          "Diferencia de juegos",
          "Head-to-head wins", 
          "Juegos ganados totales"
        ]
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        useUnifiedTiebreakers: true,
        isAdmin,
        isParticipant
      }
    });

  } catch (error: any) {
    console.error('[Rankings API] Error:', error);
    return NextResponse.json(
      { error: "Error interno del servidor", details: error.message },
      { status: 500 }
    );
  }
}