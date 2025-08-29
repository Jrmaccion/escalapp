import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type RouteParams = { params: { id: string } };

type Player = {
  id: string;
  name: string;
  joinedRound: number;
};

type GroupDistribution = 'random' | 'ranking' | 'manual';

export async function POST(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roundId = params.id;
  const { 
    strategy = 'random' as GroupDistribution,
    playersPerGroup = 4,
    force = false 
  } = await req.json().catch(() => ({}));

  try {
    // Primero obtener información básica de la ronda
    const basicRound = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, number: true, isClosed: true, tournament: { select: { id: true } } }
    });

    if (!basicRound) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    if (basicRound.isClosed) {
      return NextResponse.json({ error: "Round is closed" }, { status: 400 });
    }

    // Ahora obtener la ronda completa con todas las relaciones
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: {
          include: {
            players: {
              include: {
                player: true
              },
              where: {
                // Solo jugadores que se unieron en esta ronda o antes
                joinedRound: { lte: basicRound.number }
              }
            }
          }
        },
        groups: {
          include: {
            players: true,
            matches: true
          }
        }
      }
    });

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    // Verificar si ya tiene grupos
    if (round.groups.length > 0 && !force) {
      return NextResponse.json({ 
        error: "Round already has groups. Use force=true to regenerate." 
      }, { status: 400 });
    }

    const availablePlayers: Player[] = round.tournament.players.map((tp: any) => ({
      id: tp.player.id,
      name: tp.player.name,
      joinedRound: tp.joinedRound
    }));

    if (availablePlayers.length === 0) {
      return NextResponse.json({ 
        error: "No players available for this round" 
      }, { status: 400 });
    }

    if (availablePlayers.length % playersPerGroup !== 0) {
      return NextResponse.json({ 
        error: `Number of players (${availablePlayers.length}) is not divisible by ${playersPerGroup}` 
      }, { status: 400 });
    }

    const numberOfGroups = Math.floor(availablePlayers.length / playersPerGroup);

    // Eliminar grupos existentes si force=true
    if (force && round.groups.length > 0) {
      await prisma.group.deleteMany({
        where: { roundId }
      });
    }

    // Obtener ranking previo para estrategia por ranking
    let playersByRanking = availablePlayers;
    if (strategy === 'ranking' && round.number > 1) {
      // Buscar rankings de la ronda anterior
      const prevRanking = await prisma.ranking.findMany({
        where: {
          tournamentId: round.tournament.id,
          roundNumber: round.number - 1
        },
        orderBy: { position: 'asc' }
      });

      if (prevRanking.length > 0) {
        const rankingMap = new Map(prevRanking.map((r: any) => [r.playerId, r.position]));
        playersByRanking = availablePlayers.sort((a: Player, b: Player) => {
          const posA = rankingMap.get(a.id) || 999;
          const posB = rankingMap.get(b.id) || 999;
          return posA - posB;
        });
      }
    }

    let groupedPlayers: Player[][];

    switch (strategy) {
      case 'ranking':
        // Distribuir por ranking: 1-8-9-16, 2-7-10-15, etc.
        groupedPlayers = distributeByRanking(playersByRanking, numberOfGroups, playersPerGroup);
        break;
      
      case 'random':
      default:
        // Mezclar aleatoriamente
        const shuffled = [...availablePlayers].sort(() => Math.random() - 0.5);
        groupedPlayers = chunkArray(shuffled, playersPerGroup);
        break;
    }

    // Crear grupos en la base de datos
    const createdGroups = await Promise.all(
      groupedPlayers.map(async (groupPlayers, index) => {
        const group = await prisma.group.create({
          data: {
            roundId,
            number: index + 1,
            level: index + 1, // Por ahora nivel = número de grupo
            players: {
              create: groupPlayers.map((player, position) => ({
                playerId: player.id,
                position: position + 1,
                points: 0,
                streak: 0,
                usedComodin: false
              }))
            }
          },
          include: {
            players: {
              include: {
                player: true
              }
            }
          }
        });
        return group;
      })
    );

    return NextResponse.json({
      success: true,
      groups: createdGroups.length,
      strategy,
      playersDistributed: availablePlayers.length,
      message: `Creados ${createdGroups.length} grupos con ${playersPerGroup} jugadores cada uno usando estrategia '${strategy}'`
    });

  } catch (error) {
    console.error("Error generating groups:", error);
    return NextResponse.json({ 
      error: "Error interno del servidor",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Función para distribuir jugadores por ranking
function distributeByRanking(
  players: Player[], 
  numGroups: number, 
  playersPerGroup: number
): Player[][] {
  const groups: Player[][] = Array(numGroups).fill(null).map(() => []);
  
  // Distribuir en "serpiente" para equilibrar niveles
  // Ejemplo con 8 jugadores y 2 grupos:
  // Grupo 1: 1°, 4°, 5°, 8° 
  // Grupo 2: 2°, 3°, 6°, 7°
  
  let currentGroup = 0;
  let direction = 1; // 1 = forward, -1 = backward
  
  for (let i = 0; i < players.length; i++) {
    groups[currentGroup].push(players[i]);
    
    if (direction === 1) {
      currentGroup++;
      if (currentGroup === numGroups) {
        currentGroup = numGroups - 1;
        direction = -1;
      }
    } else {
      currentGroup--;
      if (currentGroup < 0) {
        currentGroup = 0;
        direction = 1;
      }
    }
  }
  
  return groups;
}

// Función auxiliar para dividir array en chunks
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}