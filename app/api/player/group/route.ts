// app/api/player/group/route.ts - VERSIÓN CORREGIDA CON DESEMPATES UNIFICADOS
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PartyManager } from "@/lib/party-manager";

// ✅ FUNCIONES UNIFICADAS DE DESEMPATES (igual que en points-calculator.ts)
function calculatePlayerStatsInGroup(playerId: string, matches: any[]) {
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

  return {
    playerId,
    points: 0, // Se asigna desde groupPlayer.points
    setsWon,
    gamesWon,
    gamesLost,
    gamesDifference: gamesWon - gamesLost,
    h2hWins
  };
}

function comparePlayersWithUnifiedTiebreakers(a: any, b: any): number {
  // 1. Puntos totales (descendente)
  if (a.points !== b.points) return b.points - a.points;
  
  // 2. Sets ganados (descendente)  
  if (a.setsWon !== b.setsWon) return b.setsWon - a.setsWon;
  
  // 3. Diferencia de juegos (descendente)
  if (a.gamesDifference !== b.gamesDifference) return b.gamesDifference - a.gamesDifference;
  
  // 4. Head-to-head wins (descendente)
  if (a.h2hWins !== b.h2hWins) return b.h2hWins - a.h2hWins;
  
  // 5. Juegos ganados totales (descendente)
  if (a.gamesWon !== b.gamesWon) return b.gamesWon - a.gamesWon;
  
  return 0; // Empate total
}

// Helper para resolver playerId
async function resolvePlayerId(session: any): Promise<string | null> {
  let playerId = session.user?.playerId;
  
  if (!playerId) {
    const userId = session.user?.id;
    const email = session.user?.email;
    
    if (userId) {
      const player = await prisma.player.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (player) return player.id;
    }
    
    if (email) {
      const player = await prisma.player.findFirst({
        where: { user: { email } },
        select: { id: true },
      });
      if (player) return player.id;
    }
  }
  
  return playerId || null;
}

// Helper para selección de ronda actual
function pickCurrentRound(rounds: any[]) {
  const now = new Date();
  const byNumber = rounds.slice().sort((a, b) => a.number - b.number);

  // 1. Ronda en ventana de tiempo y abierta
  const inWindow = byNumber.find(r => 
    !r.isClosed && 
    now >= new Date(r.startDate) && 
    now <= new Date(r.endDate)
  );
  if (inWindow) return inWindow;

  // 2. Cualquier ronda abierta
  const anyOpen = byNumber.find(r => !r.isClosed);
  if (anyOpen) return anyOpen;

  // 3. Última ronda como fallback
  return byNumber[byNumber.length - 1];
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ hasGroup: false, message: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedTournamentId = searchParams.get('tournamentId');

    console.log(`[/api/player/group] Usuario: ${session.user.email}, Torneo: ${requestedTournamentId || 'auto'}`);

    // 1. Resolver playerId de forma robusta
    const playerId = await resolvePlayerId(session);
    if (!playerId) {
      console.log(`[/api/player/group] No se encontró jugador para el usuario`);
      return NextResponse.json({
        hasGroup: false,
        message: "No hay jugador asociado al usuario actual"
      });
    }

    console.log(`[/api/player/group] PlayerId resuelto: ${playerId}`);

    // 2. Obtener torneos del jugador
    const tournamentPlayers = await prisma.tournamentPlayer.findMany({
      where: { playerId },
      include: {
        tournament: {
          select: { 
            id: true, 
            title: true, 
            isActive: true, 
            startDate: true, 
            totalRounds: true 
          },
        },
      },
    });

    if (tournamentPlayers.length === 0) {
      return NextResponse.json({
        hasGroup: false,
        message: "No estás inscrito en ningún torneo",
        availableTournaments: []
      });
    }

    // 3. Selección de torneo
    let selectedTournament;
    
    if (requestedTournamentId) {
      selectedTournament = tournamentPlayers.find(tp => 
        tp.tournament?.id === requestedTournamentId
      )?.tournament;
      
      if (!selectedTournament) {
        return NextResponse.json({
          hasGroup: false,
          message: "No tienes acceso al torneo solicitado",
          availableTournaments: tournamentPlayers.map(tp => ({
            id: tp.tournament?.id,
            title: tp.tournament?.title,
            isActive: tp.tournament?.isActive,
            isCurrent: false
          }))
        });
      }
    } else {
      // Selección automática: torneo activo más reciente
      const activeTournament = tournamentPlayers
        .filter(tp => tp.tournament?.isActive)
        .sort((a, b) => {
          const dateA = a.tournament?.startDate ? new Date(a.tournament.startDate) : new Date(0);
          const dateB = b.tournament?.startDate ? new Date(b.tournament.startDate) : new Date(0);
          return dateB.getTime() - dateA.getTime();
        })[0];

      selectedTournament = activeTournament?.tournament || tournamentPlayers[0]?.tournament;
    }

    if (!selectedTournament) {
      return NextResponse.json({
        hasGroup: false,
        message: "No se pudo determinar el torneo",
        availableTournaments: []
      });
    }

    const tournamentId = selectedTournament.id;
    console.log(`[/api/player/group] Torneo seleccionado: ${selectedTournament.title}`);

    // 4. Obtener rondas del torneo
    const rounds = await prisma.round.findMany({
      where: { tournamentId },
      orderBy: { number: "asc" },
      select: { id: true, number: true, startDate: true, endDate: true, isClosed: true },
    });

    if (rounds.length === 0) {
      return NextResponse.json({
        hasGroup: false,
        tournament: { 
          id: tournamentId,
          title: selectedTournament.title, 
          currentRound: 0 
        },
        availableTournaments: tournamentPlayers.map(tp => ({
          id: tp.tournament?.id,
          title: tp.tournament?.title,
          isActive: tp.tournament?.isActive,
          isCurrent: tp.tournament?.id === tournamentId
        })),
        message: "El torneo aún no tiene rondas",
      });
    }

    const currentRound = pickCurrentRound(rounds);
    console.log(`[/api/player/group] Ronda actual: ${currentRound.number}`);

    // 5. Buscar grupo del jugador - ✅ INCLUIR MATCHES PARA DESEMPATES
    let group = await prisma.group.findFirst({
      where: { 
        roundId: currentRound.id, 
        players: { some: { playerId } } 
      },
      include: {
        round: { 
          include: { 
            tournament: { select: { title: true } } 
          } 
        },
        players: { 
          include: { player: true }
          // ❌ NO ordenar aquí - lo haremos con desempates después
        },
        matches: {
          orderBy: { setNumber: 'asc' },
          select: {
            id: true,
            setNumber: true,
            team1Player1Id: true,
            team1Player2Id: true,
            team2Player1Id: true,
            team2Player2Id: true,
            team1Games: true,
            team2Games: true,
            tiebreakScore: true,
            isConfirmed: true,
          }
        },
      },
    });

    // Fallback: buscar en cualquier ronda del torneo
    if (!group) {
      console.log(`[/api/player/group] No encontrado en ronda actual, buscando en todo el torneo`);
      
      group = await prisma.group.findFirst({
        where: { 
          round: { tournamentId }, 
          players: { some: { playerId } } 
        },
        include: {
          round: { 
            include: { 
              tournament: { select: { title: true } } 
            } 
          },
          players: { 
            include: { player: true }
          },
          matches: {
            orderBy: { setNumber: 'asc' },
            select: {
              id: true,
              setNumber: true,
              team1Player1Id: true,
              team1Player2Id: true,
              team2Player1Id: true,
              team2Player2Id: true,
              team1Games: true,
              team2Games: true,
              tiebreakScore: true,
              isConfirmed: true,
            }
          },
        },
        orderBy: { round: { number: 'desc' } },
      });
    }

    if (!group) {
      return NextResponse.json({
        hasGroup: false,
        tournament: { 
          id: tournamentId,
          title: selectedTournament.title, 
          currentRound: currentRound.number 
        },
        availableTournaments: tournamentPlayers.map(tp => ({
          id: tp.tournament?.id,
          title: tp.tournament?.title,
          isActive: tp.tournament?.isActive,
          isCurrent: tp.tournament?.id === tournamentId
        })),
        message: "No estás asignado a ningún grupo en este torneo",
      });
    }

    console.log(`[/api/player/group] Grupo encontrado: ${group.number} en ronda ${group.round.number}`);

    // 6. **CRÍTICO**: Obtener datos del partido con manejo de errores
    let partyData = null;
    try {
      console.log(`[/api/player/group] Obteniendo party data para grupo ${group.id}`);
      partyData = await PartyManager.getParty(group.id, playerId);
      if (partyData) {
        console.log(`[/api/player/group] Party data obtenido: status=${partyData.status}`);
      } else {
        console.warn(`[/api/player/group] PartyManager devolvió null para grupo ${group.id}`);
      }
    } catch (error) {
      console.error(`[/api/player/group] Error obteniendo party data:`, error);
      // Continuar sin party data - no es bloqueante
    }

    // 7. Mapear nombres de jugadores
    const nameById = new Map<string, string>();
    group.players.forEach(gp => {
      nameById.set(gp.playerId, gp.player?.name ?? "Jugador");
    });

    // 8. ✅ APLICAR DESEMPATES UNIFICADOS - REEMPLAZAR LÍNEAS 244-253
    const playersWithStats = group.players.map(gp => {
      const stats = calculatePlayerStatsInGroup(gp.playerId, group.matches);
      return {
        ...gp,
        points: gp.points || 0,
        setsWon: stats.setsWon,
        gamesWon: stats.gamesWon,
        gamesLost: stats.gamesLost,
        gamesDifference: stats.gamesDifference,
        h2hWins: stats.h2hWins,
      };
    });

    // ✅ ORDENAR CON DESEMPATES UNIFICADOS
    const sortedByTiebreakers = playersWithStats.sort(comparePlayersWithUnifiedTiebreakers);

    const currentPlayer = group.players.find(gp => gp.playerId === playerId);

    // 9. **CORREGIDO**: Datos del partido formateados correctamente
    const partyForUI = partyData ? {
      id: `party-${group.id}`,
      groupId: group.id,
      status: partyData.status,
      proposedDate: partyData.proposedDate?.toISOString() || null,
      acceptedDate: partyData.acceptedDate?.toISOString() || null,
      acceptedCount: partyData.acceptedCount || 0,
      needsScheduling: partyData.status === 'PENDING',
      canSchedule: partyData.canSchedule || false,
      allSetsCompleted: partyData.status === 'COMPLETED',
      completedSets: partyData.completedSets || 0,
      totalSets: partyData.totalSets || 3,
      sets: (partyData.sets || []).map(set => ({
        id: set.id,
        setNumber: set.setNumber,
        team1Player1Name: set.team1Player1Name,
        team1Player2Name: set.team1Player2Name,
        team2Player1Name: set.team2Player1Name,
        team2Player2Name: set.team2Player2Name,
        team1Games: set.team1Games,
        team2Games: set.team2Games,
        tiebreakScore: set.tiebreakScore,
        isConfirmed: set.isConfirmed,
        hasResult: set.hasResult,
        isPending: !set.isConfirmed && !set.hasResult
      }))
    } : null;

    // 10. Datos legacy de matches (fallback)
    const legacyMatches = group.matches.map(match => ({
      id: match.id,
      setNumber: match.setNumber,
      team1Player1Name: nameById.get(match.team1Player1Id) || "Jugador",
      team1Player2Name: nameById.get(match.team1Player2Id) || "Jugador",
      team2Player1Name: nameById.get(match.team2Player1Id) || "Jugador",
      team2Player2Name: nameById.get(match.team2Player2Id) || "Jugador",
      team1Games: match.team1Games,
      team2Games: match.team2Games,
      tiebreakScore: match.tiebreakScore,
      isConfirmed: match.isConfirmed,
      hasResult: match.team1Games !== null && match.team2Games !== null,
      isPending: !match.isConfirmed,
    }));

    // 11. **RESPUESTA FINAL CORREGIDA CON POSICIONES DE DESEMPATES**
    const response = {
      hasGroup: true,
      roundId: group.round.id,
      tournament: {
        id: tournamentId,
        title: group.round.tournament.title,
        currentRound: group.round.number,
        totalRounds: selectedTournament.totalRounds || 0,
      },
      group: {
        id: group.id,
        number: group.number,
        level: `Nivel ${group.number}`,
        totalPlayers: group.players.length,
      },
      myStatus: {
        // ✅ USAR POSICIÓN CON DESEMPATES
        position: sortedByTiebreakers.findIndex(gp => gp.playerId === playerId) + 1,
        points: currentPlayer?.points || 0,
        streak: currentPlayer?.streak || 0,
      },
      // ✅ USAR JUGADORES ORDENADOS CON DESEMPATES
      players: sortedByTiebreakers.map((gp, index) => ({
        id: gp.playerId,
        name: gp.player?.name ?? "Jugador",
        points: gp.points || 0,
        position: index + 1, // Nueva posición basada en desempates
        isCurrentUser: gp.playerId === playerId,
        // ✅ INCLUIR STATS PARA COMPATIBILIDAD CON FRONTEND
        sets: gp.setsWon,
        games: gp.gamesWon,
        gamesLost: gp.gamesLost,
        setsWon: gp.setsWon,
      })),
      
      // ✅ DATOS DEL PARTIDO (corregidos)
      ...(partyForUI && { party: partyForUI }),
      
      // ✅ LISTA DE TORNEOS
      availableTournaments: tournamentPlayers.map(tp => ({
        id: tp.tournament?.id,
        title: tp.tournament?.title,
        isActive: tp.tournament?.isActive,
        isCurrent: tp.tournament?.id === tournamentId
      })),
      
      // Legacy compatibility
      allMatches: partyForUI?.sets || legacyMatches,
      
      // ✅ METADATA DE DEBUG
      _metadata: {
        usePartyData: !!partyForUI,
        partyApiVersion: "1.1",
        hasPartyScheduling: !!partyForUI,
        tournamentSelectionEnabled: tournamentPlayers.length > 1,
        tiebreakerSystemEnabled: true, // ✅ NUEVO FLAG
        debug: process.env.NODE_ENV === 'development' ? {
          playerId,
          tournamentId,
          groupId: group.id,
          roundId: group.round.id,
          roundNumber: group.round.number,
          currentRoundId: currentRound.id,
          currentRoundNumber: currentRound.number,
          partyDataStatus: partyData?.status || 'null',
          playersBeforeTiebreakers: group.players.map(gp => ({ id: gp.playerId, points: gp.points })),
          playersAfterTiebreakers: sortedByTiebreakers.map((gp, i) => ({ id: gp.playerId, points: gp.points, position: i + 1 }))
        } : undefined
      }
    };

    console.log(`[/api/player/group] Respuesta preparada exitosamente con desempates`);
    return NextResponse.json(response);

  } catch (error: any) {
    console.error("[/api/player/group] Error completo:", error);
    return NextResponse.json({
      hasGroup: false,
      message: error?.message ?? "Error interno del servidor",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}