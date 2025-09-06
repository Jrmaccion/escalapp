// app/api/player/dashboard/route.ts - ACTUALIZADO PARA USAR PARTYMANAGER

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PartyManager } from "@/lib/party-manager";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.playerId) {
      return NextResponse.json({ error: "No autorizado o no es un jugador" }, { status: 401 });
    }

    const playerId = session.user.playerId;

    // Buscar el torneo activo donde participa el jugador
    const activeTournament = await prisma.tournament.findFirst({
      where: {
        isActive: true,
        players: {
          some: {
            playerId: playerId
          }
        }
      },
      include: {
        rounds: {
          orderBy: { number: 'desc' }
        }
      }
    });

    if (!activeTournament) {
      return NextResponse.json({
        activeTournament: null,
        currentGroup: null,
        myMatches: [],
        party: null,
        ranking: null,
        stats: {
          matchesPlayed: 0,
          matchesPending: 0,
          winRate: 0,
          currentStreak: 0,
          partiesPlayed: 0,
          partiesPending: 0,
          partyWinRate: 0
        }
      });
    }

    // Encontrar la ronda actual (última ronda no cerrada)
    const currentRound = activeTournament.rounds.find(r => !r.isClosed) || 
                        activeTournament.rounds[0];

    // Buscar el grupo actual del jugador en la ronda actual
    const currentGroup = await prisma.group.findFirst({
      where: {
        roundId: currentRound.id,
        players: {
          some: {
            playerId: playerId
          }
        }
      },
      include: {
        players: {
          include: {
            player: true
          },
          orderBy: { points: 'desc' }
        }
      }
    });

    // Buscar la información del jugador en el grupo actual
    const playerInGroup = currentGroup?.players.find(p => p.playerId === playerId);

    // NUEVO: Obtener datos del partido actual usando PartyManager
    let currentParty = null;
    if (currentGroup) {
      currentParty = await PartyManager.getParty(currentGroup.id, playerId);
    }

    // Buscar los matches del jugador en la ronda actual (para compatibilidad)
    const myMatches = await prisma.match.findMany({
      where: {
        groupId: currentGroup?.id,
        OR: [
          { team1Player1Id: playerId },
          { team1Player2Id: playerId },
          { team2Player1Id: playerId },
          { team2Player2Id: playerId }
        ]
      },
      include: {
        group: true
      },
      orderBy: { setNumber: 'asc' }
    });

    // NUEVO: Obtener estadísticas históricas de partidos usando PartyManager
    const allPlayerGroups = await prisma.group.findMany({
      where: {
        round: { tournamentId: activeTournament.id },
        players: { some: { playerId } }
      },
      include: {
        round: true
      }
    });

    // Estadísticas de partidos completos
    let partiesPlayed = 0;
    let partiesWon = 0;
    let partiesPending = 0;

    for (const group of allPlayerGroups) {
      try {
        const partyData = await PartyManager.getParty(group.id, playerId);
        if (partyData) {
          if (partyData.status === 'COMPLETED') {
            partiesPlayed++;
            // Determinar si ganó el partido (más sets ganados)
            let setsWon = 0;
            for (const set of partyData.sets) {
              if (set.isConfirmed && set.team1Games !== null && set.team2Games !== null) {
                const isTeam1 = set.team1Player1Id === playerId || set.team1Player2Id === playerId;
                const team1Won = set.team1Games > set.team2Games;
                if ((isTeam1 && team1Won) || (!isTeam1 && !team1Won)) {
                  setsWon++;
                }
              }
            }
            // Ganó el partido si ganó al menos 2 de 3 sets
            if (setsWon >= 2) {
              partiesWon++;
            }
          } else if (['PENDING', 'DATE_PROPOSED', 'SCHEDULED'].includes(partyData.status)) {
            partiesPending++;
          }
        }
      } catch (error) {
        // Si hay error al obtener datos del partido, ignorar silenciosamente
        console.warn(`Error getting party data for group ${group.id}:`, error);
      }
    }

    const partyWinRate = partiesPlayed > 0 ? (partiesWon / partiesPlayed) * 100 : 0;

    // Obtener nombres de jugadores para los matches (compatibilidad)
    const allPlayerIds = [
      ...myMatches.flatMap(m => [m.team1Player1Id, m.team1Player2Id, m.team2Player1Id, m.team2Player2Id])
    ];
    
    const players = await prisma.player.findMany({
      where: { id: { in: allPlayerIds } }
    });

    const playerMap = players.reduce((acc, player) => {
      acc[player.id] = player.name;
      return acc;
    }, {} as Record<string, string>);

    // Formatear matches con nombres de jugadores (para compatibilidad)
    const formattedMatches = myMatches.map(match => ({
      id: match.id,
      setNumber: match.setNumber,
      team1Player1Name: playerMap[match.team1Player1Id] || 'Jugador desconocido',
      team1Player2Name: playerMap[match.team1Player2Id] || 'Jugador desconocido',
      team2Player1Name: playerMap[match.team2Player1Id] || 'Jugador desconocido',
      team2Player2Name: playerMap[match.team2Player2Id] || 'Jugador desconocido',
      team1Games: match.team1Games,
      team2Games: match.team2Games,
      tiebreakScore: match.tiebreakScore,
      isConfirmed: match.isConfirmed,
      reportedById: match.reportedById,
      groupNumber: match.group.number
    }));

    // Obtener ranking del jugador
    const latestRanking = await prisma.ranking.findFirst({
      where: {
        tournamentId: activeTournament.id,
        playerId: playerId
      },
      orderBy: { roundNumber: 'desc' }
    });

    // Calcular estadísticas legacy (por sets, para compatibilidad)
    const confirmedMatches = myMatches.filter(m => m.isConfirmed);
    const pendingMatches = myMatches.filter(m => !m.isConfirmed);
    
    let wins = 0;
    for (const match of confirmedMatches) {
      const isTeam1 = match.team1Player1Id === playerId || match.team1Player2Id === playerId;
      const team1Won = (match.team1Games || 0) > (match.team2Games || 0);
      if ((isTeam1 && team1Won) || (!isTeam1 && !team1Won)) {
        wins++;
      }
    }

    const winRate = confirmedMatches.length > 0 ? (wins / confirmedMatches.length) * 100 : 0;

    // NUEVO: Formatear datos del partido actual para el dashboard
    const partyForDashboard = currentParty ? {
      id: `party-${currentGroup?.id}`,
      groupId: currentGroup?.id,
      groupNumber: currentGroup?.number,
      status: currentParty.status,
      proposedDate: currentParty.proposedDate,
      acceptedDate: currentParty.acceptedDate,
      needsAction: currentParty.status === 'DATE_PROPOSED' && !currentParty.acceptedDate,
      needsScheduling: currentParty.status === 'PENDING',
      canPlay: currentParty.status === 'SCHEDULED',
      completedSets: currentParty.completedSets,
      totalSets: 3,
      progress: Math.round((currentParty.completedSets / 3) * 100),
      sets: currentParty.sets.map(set => ({
        setNumber: set.setNumber,
        isConfirmed: set.isConfirmed,
        hasResult: set.team1Games !== null && set.team2Games !== null
      }))
    } : null;

    // Preparar respuesta con datos legacy y nuevos
    const response = {
      activeTournament: {
        id: activeTournament.id,
        title: activeTournament.title,
        currentRound: currentRound.number,
        totalRounds: activeTournament.totalRounds,
        roundEndDate: currentRound.endDate.toISOString()
      },
      currentGroup: currentGroup ? {
        id: currentGroup.id,
        number: currentGroup.number,
        level: currentGroup.level,
        position: playerInGroup?.position || 0,
        points: playerInGroup?.points || 0,
        streak: playerInGroup?.streak || 0,
        players: currentGroup.players.map(p => ({
          id: p.playerId,
          name: p.player.name,
          position: p.position,
          points: p.points
        }))
      } : null,
      
      // LEGACY: Compatibilidad con componentes existentes
      myMatches: formattedMatches,
      
      // NUEVO: Datos de partido unificados
      party: partyForDashboard,
      
      ranking: latestRanking ? {
        position: latestRanking.position,
        averagePoints: latestRanking.averagePoints,
        totalPoints: latestRanking.totalPoints,
        roundsPlayed: latestRanking.roundsPlayed,
        ironmanPosition: latestRanking.ironmanPosition
      } : null,
      
      stats: {
        // LEGACY: Estadísticas por sets (para compatibilidad)
        matchesPlayed: confirmedMatches.length,
        matchesPending: pendingMatches.length,
        winRate: Math.round(winRate),
        currentStreak: playerInGroup?.streak || 0,
        
        // NUEVO: Estadísticas por partidos completos
        partiesPlayed,
        partiesPending,
        partyWinRate: Math.round(partyWinRate),
        totalPartiesInTournament: allPlayerGroups.length
      },

      // NUEVO: Metadatos para el cliente
      _metadata: {
        usePartyData: true,
        hasPartyStats: true,
        partyApiVersion: "1.0"
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching player dashboard:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}