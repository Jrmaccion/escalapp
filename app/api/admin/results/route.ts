// app/api/admin/results/route.ts - UNIFICADO CON DESEMPATES
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// Función unificada de cálculo de estadísticas con desempates
function calculateUnifiedPlayerStats(playerId: string, matches: any[]) {
  let setsWon = 0;
  let gamesWon = 0;
  let gamesLost = 0;
  let h2hWins = 0;

  for (const match of matches) {
    if (!match.isConfirmed) continue;

    const isInTeam1 = [match.team1Player1Id, match.team1Player2Id].includes(playerId);
    const isInTeam2 = [match.team2Player1Id, match.team2Player2Id].includes(playerId);

    if (isInTeam1) {
      gamesWon += match.team1Games || 0;
      gamesLost += match.team2Games || 0;
      if ((match.team1Games || 0) > (match.team2Games || 0)) {
        setsWon++;
        h2hWins++;
      }
    } else if (isInTeam2) {
      gamesWon += match.team2Games || 0;
      gamesLost += match.team1Games || 0;
      if ((match.team2Games || 0) > (match.team1Games || 0)) {
        setsWon++;
        h2hWins++;
      }
    }
  }

  return { setsWon, gamesWon, gamesLost, gamesDifference: gamesWon - gamesLost, h2hWins };
}

// Función unificada de comparación
function comparePlayersUnified(a: any, b: any): number {
  // 1. Puntos (descendente)
  if (a.points !== b.points) return b.points - a.points;
  
  // 2. Sets ganados (descendente)
  if (a.setsWon !== b.setsWon) return b.setsWon - a.setsWon;
  
  // 3. Diferencia de juegos (descendente)
  if (a.gamesDifference !== b.gamesDifference) return b.gamesDifference - a.gamesDifference;
  
  // 4. Head-to-head wins (descendente)
  if (a.h2hWins !== b.h2hWins) return b.h2hWins - a.h2hWins;
  
  // 5. Juegos ganados totales (descendente)
  if (a.gamesWon !== b.gamesWon) return b.gamesWon - a.gamesWon;
  
  return 0;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !session.user.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');
    const roundId = searchParams.get('roundId');
    const groupId = searchParams.get('groupId');

    // Construir filtros
    let whereClause: any = {};
    if (tournamentId) whereClause.group = { round: { tournamentId } };
    if (roundId) whereClause.group = { roundId };
    if (groupId) whereClause.groupId = groupId;

    // Obtener matches con información completa
    const matches = await prisma.match.findMany({
      where: whereClause,
      include: {
        group: {
          include: {
            round: {
              include: {
                tournament: { select: { id: true, title: true } }
              }
            },
            players: {
              include: {
                player: { select: { id: true, name: true } }
              },
              orderBy: { position: 'asc' }
            }
          }
        }
      },
      orderBy: [
        { group: { round: { tournament: { title: 'asc' } } } },
        { group: { round: { number: 'desc' } } },
        { group: { number: 'asc' } },
        { setNumber: 'asc' }
      ]
    });

    // Procesar resultados con estadísticas unificadas
    const processedMatches = matches.map(match => {
      // Recalcular posiciones del grupo con desempates
      const groupPlayers = match.group.players.map(gp => {
        const stats = calculateUnifiedPlayerStats(gp.playerId, match.group.players);
        return {
          playerId: gp.playerId,
          name: gp.player.name,
          points: gp.points || 0,
          position: gp.position,
          ...stats
        };
      });

      // Ordenar con criterios unificados y asignar posiciones corregidas
      groupPlayers.sort(comparePlayersUnified);
      const correctedPositions = groupPlayers.map((p, index) => ({
        ...p,
        correctedPosition: index + 1,
        positionChange: p.position - (index + 1)
      }));

      return {
        id: match.id,
        setNumber: match.setNumber,
        groupId: match.groupId,
        groupNumber: match.group.number,
        roundNumber: match.group.round.number,
        tournamentTitle: match.group.round.tournament.title,
        team1Player1Name: correctedPositions.find(p => p.playerId === match.team1Player1Id)?.name || 'N/A',
        team1Player2Name: correctedPositions.find(p => p.playerId === match.team1Player2Id)?.name || 'N/A',
        team2Player1Name: correctedPositions.find(p => p.playerId === match.team2Player1Id)?.name || 'N/A',
        team2Player2Name: correctedPositions.find(p => p.playerId === match.team2Player2Id)?.name || 'N/A',
        team1Games: match.team1Games,
        team2Games: match.team2Games,
        tiebreakScore: match.tiebreakScore,
        isConfirmed: match.isConfirmed,
        status: match.status,
        reportedById: match.reportedById,
        confirmedById: match.confirmedById,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
        // Información adicional para admin
        groupPlayers: correctedPositions,
        hasPositionChanges: correctedPositions.some(p => p.positionChange !== 0)
      };
    });

    // Estadísticas generales
    const stats = {
      totalMatches: processedMatches.length,
      confirmedMatches: processedMatches.filter(m => m.isConfirmed).length,
      pendingMatches: processedMatches.filter(m => !m.isConfirmed).length,
      groupsWithPositionChanges: new Set(
        processedMatches
          .filter(m => m.hasPositionChanges)
          .map(m => m.groupId)
      ).size,
      tournaments: new Set(processedMatches.map(m => m.tournamentTitle)).size,
      rounds: new Set(processedMatches.map(m => `${m.tournamentTitle}-R${m.roundNumber}`)).size
    };

    return NextResponse.json({
      success: true,
      matches: processedMatches,
      stats,
      criteria: [
        "Puntos totales",
        "Sets ganados", 
        "Diferencia de juegos",
        "Head-to-head wins",
        "Juegos ganados totales"
      ],
      metadata: {
        generatedAt: new Date().toISOString(),
        useUnifiedTiebreakers: true
      }
    });

  } catch (error: any) {
    console.error('[Admin Results] Error:', error);
    return NextResponse.json(
      { error: "Error interno del servidor", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !session.user.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { action, matchId, ...data } = body;

    switch (action) {
      case 'confirm':
        await prisma.match.update({
          where: { id: matchId },
          data: { 
            isConfirmed: true,
            confirmedById: session.user.id,
            updatedAt: new Date()
          }
        });

        // Recalcular posiciones del grupo después de confirmar
        const match = await prisma.match.findUnique({
          where: { id: matchId },
          include: {
            group: {
              include: {
                players: { include: { player: true } },
                matches: { where: { isConfirmed: true } }
              }
            }
          }
        });

        if (match) {
          await recalculateGroupPositions(match.group);
        }

        return NextResponse.json({ success: true, message: 'Match confirmado y posiciones actualizadas' });

      case 'edit':
        await prisma.match.update({
          where: { id: matchId },
          data: {
            team1Games: data.team1Games,
            team2Games: data.team2Games,
            tiebreakScore: data.tiebreakScore,
            isConfirmed: false, // Requiere nueva confirmación
            updatedAt: new Date()
          }
        });
        return NextResponse.json({ success: true, message: 'Match editado' });

      case 'reject':
        await prisma.match.update({
          where: { id: matchId },
          data: {
            team1Games: null,
            team2Games: null,
            tiebreakScore: null,
            isConfirmed: false,
            reportedById: null,
            updatedAt: new Date()
          }
        });
        return NextResponse.json({ success: true, message: 'Match rechazado' });

      default:
        return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[Admin Results POST] Error:', error);
    return NextResponse.json(
      { error: "Error procesando solicitud", details: error.message },
      { status: 500 }
    );
  }
}

// Helper para recalcular posiciones de grupo con lógica unificada
async function recalculateGroupPositions(group: any) {
  const playersWithStats = group.players.map((gp: any) => {
    const stats = calculateUnifiedPlayerStats(gp.playerId, group.matches);
    return {
      groupPlayerId: gp.id,
      playerId: gp.playerId,
      points: gp.points || 0,
      ...stats
    };
  });

  // Ordenar con criterios unificados
  playersWithStats.sort(comparePlayersUnified);

  // Actualizar posiciones en la base de datos
  for (let i = 0; i < playersWithStats.length; i++) {
    await prisma.groupPlayer.update({
      where: { id: playersWithStats[i].groupPlayerId },
      data: { position: i + 1 }
    });
  }

  console.log(`✅ Posiciones recalculadas para grupo ${group.id}`);
}