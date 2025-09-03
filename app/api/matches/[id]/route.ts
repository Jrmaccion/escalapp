// app/api/matches/[id]/route.ts - VERSIÓN CORREGIDA CON SISTEMA DE SUSTITUTOS
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        group: {
          include: {
            round: {
              include: {
                tournament: true
              }
            },
            players: {
              include: {
                player: true
              }
            }
          }
        }
      }
    });

    if (!match) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    // Verificar permisos: admin o jugador participante
    const playerId = session.user.playerId;
    const isAdmin = session.user.isAdmin;
    const isPlayerInMatch = playerId && [
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id
    ].includes(playerId);

    if (!isAdmin && !isPlayerInMatch) {
      return NextResponse.json({ error: "Sin permisos para ver este partido" }, { status: 403 });
    }

    return NextResponse.json(match);
  } catch (error) {
    console.error("Error fetching match:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { team1Games, team2Games, tiebreakScore, action, photoUrl } = body;

    // Validar datos
    if (typeof team1Games !== 'number' || typeof team2Games !== 'number') {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    if (team1Games < 0 || team1Games > 5 || team2Games < 0 || team2Games > 5) {
      return NextResponse.json({ error: "Juegos deben estar entre 0 y 5" }, { status: 400 });
    }

    // Validar reglas de pádel
    const maxGames = Math.max(team1Games, team2Games);
    const diff = Math.abs(team1Games - team2Games);

    if (maxGames < 4) {
      return NextResponse.json({ error: "Al menos un equipo debe llegar a 4 juegos" }, { status: 400 });
    }

    if (team1Games === 4 && team2Games === 4 && !tiebreakScore) {
      return NextResponse.json({ error: "Se requiere tie-break cuando hay 4-4" }, { status: 400 });
    }

    if (maxGames === 4 && diff < 2 && !tiebreakScore) {
      return NextResponse.json({ error: "Se requiere diferencia de 2 juegos o tie-break" }, { status: 400 });
    }

    // Validar formato tie-break
    if (tiebreakScore) {
      const tiebreakRegex = /^\d+-\d+$/;
      if (!tiebreakRegex.test(tiebreakScore)) {
        return NextResponse.json({ error: "Formato de tie-break inválido (usar: 7-5)" }, { status: 400 });
      }
    }

    // Buscar el match
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        group: {
          include: {
            round: {
              include: {
                tournament: true
              }
            }
          }
        }
      }
    });

    if (!match) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    // Verificar que la ronda no esté cerrada
    if (match.group.round.isClosed) {
      return NextResponse.json({ error: "No se pueden modificar partidos de rondas cerradas" }, { status: 400 });
    }

    const playerId = session.user.playerId;
    const isAdmin = session.user.isAdmin;
    const isPlayerInMatch = playerId && [
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id
    ].includes(playerId);

    // Verificar permisos según la acción
    if (!isAdmin && !isPlayerInMatch) {
      return NextResponse.json({ error: "Sin permisos para modificar este partido" }, { status: 403 });
    }

    let updateData: any = {
      team1Games,
      team2Games,
      tiebreakScore: tiebreakScore || null
    };

    if (photoUrl) {
      updateData.photoUrl = photoUrl;
    }

    // Lógica según el tipo de acción
    if (action === 'report' && !isAdmin) {
      // Jugador reportando resultado
      if (match.reportedById) {
        return NextResponse.json({ error: "Ya hay un resultado reportado" }, { status: 400 });
      }
      
      updateData.reportedById = playerId;
      updateData.isConfirmed = false;
      
    } else if (action === 'confirm' && !isAdmin) {
      // Jugador confirmando resultado
      if (!match.reportedById) {
        return NextResponse.json({ error: "No hay resultado para confirmar" }, { status: 400 });
      }
      
      if (match.reportedById === playerId) {
        return NextResponse.json({ error: "No puedes confirmar tu propio resultado" }, { status: 400 });
      }
      
      if (match.confirmedById) {
        return NextResponse.json({ error: "El resultado ya está confirmado" }, { status: 400 });
      }
      
      updateData.confirmedById = playerId;
      updateData.isConfirmed = true;
      
    } else if (isAdmin) {
      // Admin puede forzar cualquier cambio
      updateData.isConfirmed = true;
      updateData.reportedById = updateData.reportedById || playerId;
      updateData.confirmedById = updateData.confirmedById || playerId;
    } else {
      return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    }

    // Actualizar el match
    const updatedMatch = await prisma.match.update({
      where: { id: params.id },
      data: updateData
    });

    // Si el resultado está confirmado, recalcular puntos del grupo
    if (updateData.isConfirmed) {
      await recalculateGroupPointsWithSubstituteSupport(match.group.id);
    }

    return NextResponse.json(updatedMatch);
  } catch (error) {
    console.error("Error updating match:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// FUNCIÓN CORREGIDA: Recalcular puntos considerando el sistema de sustitutos
async function recalculateGroupPointsWithSubstituteSupport(groupId: string) {
  try {
    // Obtener todos los matches confirmados del grupo
    const matches = await prisma.match.findMany({
      where: {
        groupId,
        isConfirmed: true
      },
      orderBy: { setNumber: 'asc' }
    });

    // Obtener jugadores del grupo con información completa
    const groupPlayers = await prisma.groupPlayer.findMany({
      where: { groupId },
      include: {
        player: true,
        group: {
          include: {
            round: {
              include: {
                tournament: true
              }
            }
          }
        }
      }
    });

    // Crear mapa de sustitutos: quien juega físicamente -> quien recibe puntos
    const substituteMap = new Map<string, string>();
    for (const gp of groupPlayers) {
      if (gp.substitutePlayerId) {
        // gp.playerId es el sustituido, gp.substitutePlayerId es quien juega
        substituteMap.set(gp.substitutePlayerId, gp.playerId);
      }
    }

    // Calcular rachas consecutivas
    const playerStreaks = await calculateConsecutiveStreaks(groupId);

    // Recalcular puntos para cada jugador
    for (const groupPlayer of groupPlayers) {
      let totalPoints = 0;

      // Si el jugador usó comodín de "media", mantener esos puntos
      if (groupPlayer.usedComodin && !groupPlayer.substitutePlayerId) {
        totalPoints = groupPlayer.points || 0; // Mantener puntos de media
      } else {
        // Calcular puntos desde matches
        for (const match of matches) {
          // Determinar quien recibe puntos por este match
          const pointRecipientId = getPointRecipientForMatch(match, groupPlayer.playerId, substituteMap);
          if (pointRecipientId) {
            const playerPoints = calculatePlayerPointsInMatch(match, pointRecipientId);
            totalPoints += playerPoints;
          }
        }
      }

      // Aplicar bonus de racha consecutiva (+2 puntos por match si tiene racha >= 1)
      const playerStreak = playerStreaks[groupPlayer.playerId] || 0;
      if (playerStreak >= 1 && !groupPlayer.usedComodin) {
        // Solo aplicar racha si jugó realmente (no usó comodín)
        const matchesPlayedByThisPlayer = matches.filter(match => {
          // Verificar si este jugador (o su sustituto) participó físicamente
          const physicalPlayerId = groupPlayer.substitutePlayerId || groupPlayer.playerId;
          return [
            match.team1Player1Id,
            match.team1Player2Id,
            match.team2Player1Id,
            match.team2Player2Id
          ].includes(physicalPlayerId);
        }).length;
        
        totalPoints += matchesPlayedByThisPlayer * 2;
      }

      // Actualizar puntos y racha del jugador
      await prisma.groupPlayer.update({
        where: { id: groupPlayer.id },
        data: { 
          points: totalPoints,
          streak: playerStreak
        }
      });
    }

    // NUEVO: Actualizar posiciones basadas en puntos
    await updateGroupPositions(groupId);

    console.log(`Puntos y posiciones recalculados para grupo ${groupId} con soporte de sustitutos`);
  } catch (error) {
    console.error("Error recalculando puntos del grupo:", error);
  }
}

// NUEVA FUNCIÓN: Determina quién recibe los puntos de un match considerando sustitutos
function getPointRecipientForMatch(
  match: any, 
  groupPlayerId: string, 
  substituteMap: Map<string, string>
): string | null {
  const matchPlayerIds = [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id
  ];

  // Caso 1: El jugador del grupo jugó físicamente
  if (matchPlayerIds.includes(groupPlayerId)) {
    return groupPlayerId;
  }

  // Caso 2: El jugador usó sustituto - verificar si su sustituto jugó
  const substituteId = Array.from(substituteMap.keys()).find(
    subId => substituteMap.get(subId) === groupPlayerId
  );
  
  if (substituteId && matchPlayerIds.includes(substituteId)) {
    return substituteId; // Devolver el ID del sustituto para calcular puntos
  }

  return null; // Este jugador no participó en este match
}

// FUNCIÓN EXISTENTE: Calcular puntos de un jugador en un match específico
function calculatePlayerPointsInMatch(match: any, playerId: string): number {
  let points = 0;

  // Determinar en qué equipo está el jugador
  const isTeam1 = match.team1Player1Id === playerId || match.team1Player2Id === playerId;
  const isTeam2 = match.team2Player1Id === playerId || match.team2Player2Id === playerId;

  if (!isTeam1 && !isTeam2) return 0;

  // REGLA 1: +1 punto por cada juego ganado
  if (isTeam1) {
    points += match.team1Games || 0;
  } else {
    points += match.team2Games || 0;
  }

  // REGLA 2: +1 punto extra si ganó el set
  let team1Won = false;
  
  if (match.team1Games === 4 && match.team2Games === 4 && match.tiebreakScore) {
    team1Won = match.team1Games === 5;
  } else {
    team1Won = (match.team1Games || 0) > (match.team2Games || 0);
  }
  
  if ((isTeam1 && team1Won) || (isTeam2 && !team1Won)) {
    points += 1; // +1 punto extra por ganar el set
  }

  return points;
}

// NUEVA FUNCIÓN: Actualizar posiciones basadas en puntos reales
async function updateGroupPositions(groupId: string) {
  try {
    // Obtener jugadores ordenados por puntos descendentes
    const groupPlayers = await prisma.groupPlayer.findMany({
      where: { groupId },
      orderBy: { points: 'desc' }
    });

    // Actualizar posiciones
    for (let i = 0; i < groupPlayers.length; i++) {
      await prisma.groupPlayer.update({
        where: { id: groupPlayers[i].id },
        data: { position: i + 1 }
      });
    }

    console.log(`Posiciones actualizadas para grupo ${groupId}`);
  } catch (error) {
    console.error("Error actualizando posiciones del grupo:", error);
  }
}

// FUNCIÓN EXISTENTE: Calcular rachas consecutivas
async function calculateConsecutiveStreaks(groupId: string): Promise<Record<string, number>> {
  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        round: {
          include: {
            tournament: true
          }
        },
        players: true
      }
    });

    if (!group) return {};

    const streaks: Record<string, number> = {};
    
    for (const groupPlayer of group.players) {
      const playerId = groupPlayer.playerId;
      
      const playerRounds = await prisma.groupPlayer.findMany({
        where: {
          playerId,
          group: {
            round: {
              tournamentId: group.round.tournament.id,
              number: { lte: group.round.number },
              isClosed: true
            }
          }
        },
        include: {
          group: {
            include: {
              round: true
            }
          }
        },
        orderBy: {
          group: {
            round: {
              number: 'desc'
            }
          }
        }
      });

      let consecutiveRounds = 0;
      let expectedRound = group.round.number - 1;

      for (const playerRound of playerRounds) {
        if (playerRound.group.round.number === expectedRound && !playerRound.usedComodin) {
          consecutiveRounds++;
          expectedRound--;
        } else {
          break;
        }
      }

      streaks[playerId] = Math.max(0, consecutiveRounds - 1);
    }

    return streaks;
  } catch (error) {
    console.error("Error calculando rachas consecutivas:", error);
    return {};
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Solo admins pueden eliminar resultados" }, { status: 401 });
    }

    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        group: {
          include: {
            round: true
          }
        }
      }
    });

    if (!match) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    if (match.group.round.isClosed) {
      return NextResponse.json({ error: "No se pueden modificar partidos de rondas cerradas" }, { status: 400 });
    }

    // Limpiar resultado
    const updatedMatch = await prisma.match.update({
      where: { id: params.id },
      data: {
        team1Games: null,
        team2Games: null,
        tiebreakScore: null,
        isConfirmed: false,
        reportedById: null,
        confirmedById: null,
        photoUrl: null
      }
    });

    // Recalcular puntos del grupo
    await recalculateGroupPointsWithSubstituteSupport(match.group.id);

    return NextResponse.json(updatedMatch);
  } catch (error) {
    console.error("Error deleting match result:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}