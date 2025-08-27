import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar que la ronda actual existe y está cerrada
    const currentRound = await prisma.round.findUnique({
      where: { id: params.id },
      include: {
        tournament: true,
        groups: {
          include: {
            players: {
              include: {
                player: true
              },
              orderBy: { position: 'asc' }
            }
          }
        }
      }
    });

    if (!currentRound) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    if (!currentRound.isClosed) {
      return NextResponse.json({ error: "La ronda debe estar cerrada antes de generar la siguiente" }, { status: 400 });
    }

    // Verificar que no se exceda el número máximo de rondas
    if (currentRound.number >= currentRound.tournament.totalRounds) {
      return NextResponse.json({ error: "El torneo ya ha completado todas las rondas" }, { status: 400 });
    }

    // Verificar que la siguiente ronda no existe ya
    const existingNextRound = await prisma.round.findFirst({
      where: {
        tournamentId: currentRound.tournamentId,
        number: currentRound.number + 1
      }
    });

    if (existingNextRound) {
      return NextResponse.json({ error: "La siguiente ronda ya existe" }, { status: 400 });
    }

    // Calcular fechas para la nueva ronda
    const startDate = new Date(currentRound.endDate);
    startDate.setDate(startDate.getDate() + 1); // Empieza un día después de que termine la actual

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + currentRound.tournament.roundDurationDays);

    // Crear la nueva ronda
    const newRound = await prisma.round.create({
      data: {
        tournamentId: currentRound.tournamentId,
        number: currentRound.number + 1,
        startDate,
        endDate,
        isClosed: false
      }
    });

    // Generar grupos para la nueva ronda basado en resultados de la ronda anterior
    await generateGroupsForNewRound(currentRound, newRound.id);

    return NextResponse.json({ 
      message: "Siguiente ronda generada exitosamente",
      round: newRound 
    });
  } catch (error) {
    console.error("Error generating next round:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// Función auxiliar para generar grupos de la nueva ronda
async function generateGroupsForNewRound(currentRound: any, newRoundId: string) {
  try {
    // Obtener todos los jugadores ordenados por su rendimiento en la ronda actual
    const allPlayers: any[] = [];
    
    currentRound.groups.forEach((group: any) => {
      group.players.forEach((gp: any) => {
        allPlayers.push({
          playerId: gp.playerId,
          playerName: gp.player.name,
          currentLevel: group.level,
          position: gp.position,
          points: gp.points,
          groupId: group.id
        });
      });
    });

    // Ordenar jugadores por nivel y posición para determinar movimientos
    allPlayers.sort((a, b) => {
      if (a.currentLevel !== b.currentLevel) {
        return a.currentLevel - b.currentLevel; // Nivel menor primero (nivel 1 = más alto)
      }
      return a.position - b.position; // Mejor posición primero
    });

    // Determinar movimientos (simplificado - ajusta según tus reglas)
    const movements = calculatePlayerMovements(allPlayers);

    // Crear nuevos grupos
    const playersPerGroup = 4; // Ajusta según tu configuración
    const numberOfGroups = Math.ceil(allPlayers.length / playersPerGroup);

    for (let level = 1; level <= numberOfGroups; level++) {
      const group = await prisma.group.create({
        data: {
          roundId: newRoundId,
          number: level,
          level: level
        }
      });

      // Asignar jugadores al grupo
      const startIndex = (level - 1) * playersPerGroup;
      const endIndex = Math.min(startIndex + playersPerGroup, allPlayers.length);
      
      for (let i = startIndex; i < endIndex; i++) {
        if (allPlayers[i]) {
          await prisma.groupPlayer.create({
            data: {
              groupId: group.id,
              playerId: allPlayers[i].playerId,
              position: i - startIndex + 1,
              points: 0, // Empezar con 0 puntos en la nueva ronda
              streak: 0  // Reset de racha
            }
          });
        }
      }

      // Generar partidos para el grupo (todos contra todos)
      await generateMatchesForGroup(group.id);
    }
  } catch (error) {
    console.error("Error generating groups for new round:", error);
    throw error;
  }
}

// Función para calcular movimientos de jugadores entre niveles
function calculatePlayerMovements(players: any[]) {
  // Lógica simplificada de movimientos
  // Los primeros de cada grupo suben, los últimos bajan
  // Ajusta esta lógica según las reglas de tu torneo
  
  return players.map((player, index) => ({
    ...player,
    newLevel: Math.max(1, Math.min(
      Math.ceil(players.length / 4), // Número máximo de grupos
      player.position <= 2 ? Math.max(1, player.currentLevel - 1) : // Los 2 primeros suben
      player.position >= 3 ? player.currentLevel + 1 : // Los 2 últimos bajan
      player.currentLevel // Los del medio se quedan
    ))
  }));
}

// Función para generar partidos dentro de un grupo
async function generateMatchesForGroup(groupId: string) {
  try {
    const groupPlayers = await prisma.groupPlayer.findMany({
      where: { groupId },
      orderBy: { position: 'asc' }
    });

    if (groupPlayers.length < 4) {
      console.warn(`Group ${groupId} has fewer than 4 players, skipping match generation`);
      return;
    }

    // Generar partidos para un grupo de 4 (ajusta según tu formato)
    // Set 1: 1-2 vs 3-4
    await prisma.match.create({
      data: {
        groupId,
        setNumber: 1,
        team1Player1Id: groupPlayers[0].playerId,
        team1Player2Id: groupPlayers[1].playerId,
        team2Player1Id: groupPlayers[2].playerId,
        team2Player2Id: groupPlayers[3].playerId,
        isConfirmed: false
      }
    });

    // Set 2: 1-3 vs 2-4
    await prisma.match.create({
      data: {
        groupId,
        setNumber: 2,
        team1Player1Id: groupPlayers[0].playerId,
        team1Player2Id: groupPlayers[2].playerId,
        team2Player1Id: groupPlayers[1].playerId,
        team2Player2Id: groupPlayers[3].playerId,
        isConfirmed: false
      }
    });

    // Set 3: 1-4 vs 2-3
    await prisma.match.create({
      data: {
        groupId,
        setNumber: 3,
        team1Player1Id: groupPlayers[0].playerId,
        team1Player2Id: groupPlayers[3].playerId,
        team2Player1Id: groupPlayers[1].playerId,
        team2Player2Id: groupPlayers[2].playerId,
        isConfirmed: false
      }
    });
  } catch (error) {
    console.error("Error generating matches for group:", error);
    throw error;
  }
}