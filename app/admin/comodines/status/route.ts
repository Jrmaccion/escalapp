// app/api/admin/comodines/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(session.user as any).isAdmin) {
      return NextResponse.json({ error: "No autorizado - Solo admins" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get('roundId');
    
    if (!roundId) {
      return NextResponse.json({ error: "Falta roundId" }, { status: 400 });
    }

    // Obtener información de la ronda
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: {
          select: { id: true, title: true }
        }
      }
    });

    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    // Obtener todos los jugadores de la ronda con información completa
    const groupPlayers = await prisma.groupPlayer.findMany({
      where: {
        group: { roundId }
      },
      include: {
        player: {
          select: { id: true, name: true }
        },
        group: {
          include: {
            matches: {
              where: {
                OR: [
                  { team1Player1Id: { in: [] } }, // Se llenará dinámicamente
                  { team1Player2Id: { in: [] } },
                  { team2Player1Id: { in: [] } },
                  { team2Player2Id: { in: [] } }
                ]
              },
              select: {
                id: true,
                proposedDate: true,
                acceptedDate: true,
                status: true,
                isConfirmed: true,
                team1Player1Id: true,
                team1Player2Id: true,
                team2Player1Id: true,
                team2Player2Id: true
              }
            }
          }
        }
      },
      orderBy: [
        { group: { number: 'asc' } },
        { position: 'asc' }
      ]
    });

    // Obtener información de sustitutos
    const substitutePlayerIds = groupPlayers
      .map(gp => gp.substitutePlayerId)
      .filter(id => id !== null) as string[];

    const substitutePlayers = substitutePlayerIds.length > 0 
      ? await prisma.player.findMany({
          where: { id: { in: substitutePlayerIds } },
          select: { id: true, name: true }
        })
      : [];

    const substituteMap = new Map(substitutePlayers.map(p => [p.id, p.name]));

    // Procesar cada jugador
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + (24 * 60 * 60 * 1000));

    const playersStatus = await Promise.all(
      groupPlayers.map(async (groupPlayer) => {
        const playerId = groupPlayer.player.id;

        // Obtener partidos del jugador
        const playerMatches = await prisma.match.findMany({
          where: {
            groupId: groupPlayer.group.id,
            OR: [
              { team1Player1Id: playerId },
              { team1Player2Id: playerId },
              { team2Player1Id: playerId },
              { team2Player2Id: playerId }
            ]
          },
          select: {
            id: true,
            proposedDate: true,
            acceptedDate: true,
            status: true,
            isConfirmed: true
          }
        });

        // Analizar restricciones temporales
        const confirmedMatches = playerMatches.filter(match => match.isConfirmed);
        const upcomingMatches = playerMatches.filter(match => 
          match.acceptedDate && new Date(match.acceptedDate) <= twentyFourHoursFromNow
        );

        const canRevoke = groupPlayer.usedComodin && 
          upcomingMatches.length === 0 && 
          confirmedMatches.length === 0 &&
          !round.isClosed;

        let restrictionReason = "";
        if (groupPlayer.usedComodin && !canRevoke) {
          if (round.isClosed) {
            restrictionReason = "Ronda cerrada";
          } else if (confirmedMatches.length > 0) {
            restrictionReason = "Partidos confirmados";
          } else if (upcomingMatches.length > 0) {
            const nextMatch = upcomingMatches[0];
            const matchDate = new Date(nextMatch.acceptedDate!);
            restrictionReason = `Partido en <24h (${matchDate.toLocaleDateString('es-ES')})`;
          }
        }

        return {
          playerId: groupPlayer.player.id,
          playerName: groupPlayer.player.name,
          groupNumber: groupPlayer.group.number,
          usedComodin: groupPlayer.usedComodin,
          comodinMode: groupPlayer.substitutePlayerId ? 'substitute' as const : 'mean' as const,
          substitutePlayerName: groupPlayer.substitutePlayerId 
            ? substituteMap.get(groupPlayer.substitutePlayerId) 
            : undefined,
          points: groupPlayer.points || 0,
          comodinReason: groupPlayer.comodinReason,
          appliedAt: groupPlayer.comodinAt?.toISOString(),
          canRevoke,
          restrictionReason: restrictionReason || undefined,
          hasConfirmedMatches: confirmedMatches.length > 0,
          hasUpcomingMatches: upcomingMatches.length > 0,
          nextMatchDate: upcomingMatches.length > 0 
            ? upcomingMatches[0].acceptedDate 
            : undefined
        };
      })
    );

    // Estadísticas generales
    const totalPlayers = playersStatus.length;
    const playersWithComodin = playersStatus.filter(p => p.usedComodin).length;
    const playersWithSubstitute = playersStatus.filter(p => p.comodinMode === 'substitute' && p.usedComodin).length;
    const playersWithMean = playersStatus.filter(p => p.comodinMode === 'mean' && p.usedComodin).length;
    const revocableComodines = playersStatus.filter(p => p.canRevoke).length;

    return NextResponse.json({
      success: true,
      round: {
        id: round.id,
        number: round.number,
        isClosed: round.isClosed,
        tournament: {
          id: round.tournament.id,
          title: round.tournament.title
        }
      },
      stats: {
        totalPlayers,
        playersWithComodin,
        playersWithSubstitute,
        playersWithMean,
        revocableComodines,
        playersWithoutComodin: totalPlayers - playersWithComodin
      },
      players: playersStatus
    });

  } catch (error) {
    console.error("[ADMIN_COMODINES_STATUS] error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" }, 
      { status: 500 }
    );
  }
}