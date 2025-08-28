import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// Obtener jugadores disponibles y actuales del torneo
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournamentId = params.id;

    // Verificar que el torneo existe
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        players: {
          include: {
            player: true
          }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    // Obtener jugadores ya en el torneo
    const currentPlayers = tournament.players.map(tp => ({
      id: tp.player.id,
      name: tp.player.name,
      joinedRound: tp.joinedRound,
      comodinesUsed: tp.comodinesUsed
    }));

    // Obtener jugadores disponibles (no en este torneo)
    const currentPlayerIds = currentPlayers.map(p => p.id);
    const availablePlayers = await prisma.player.findMany({
      where: {
        id: { notIn: currentPlayerIds }
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const formattedAvailablePlayers = availablePlayers.map(player => ({
      id: player.id,
      name: player.name,
      email: player.user.email
    }));

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        title: tournament.title,
        isActive: tournament.isActive,
        totalRounds: tournament.totalRounds
      },
      currentPlayers,
      availablePlayers: formattedAvailablePlayers
    });

  } catch (error) {
    console.error("Error fetching tournament players:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// Añadir jugadores al torneo
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournamentId = params.id;
    const body = await request.json();
    const { playerIds, joinRound } = body;

    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      return NextResponse.json({ error: "Debe especificar al menos un jugador" }, { status: 400 });
    }

    if (!joinRound || joinRound < 1) {
      return NextResponse.json({ error: "Ronda de incorporación inválida" }, { status: 400 });
    }

    // Verificar que el torneo existe y está activo
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId }
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    if (!tournament.isActive) {
      return NextResponse.json({ error: "No se pueden añadir jugadores a un torneo inactivo" }, { status: 400 });
    }

    if (joinRound > tournament.totalRounds) {
      return NextResponse.json({ error: "La ronda de incorporación no puede ser mayor al total de rondas" }, { status: 400 });
    }

    // Verificar que los jugadores existen y no están ya en el torneo
    const existingPlayers = await prisma.player.findMany({
      where: { id: { in: playerIds } }
    });

    if (existingPlayers.length !== playerIds.length) {
      return NextResponse.json({ error: "Algunos jugadores no existen" }, { status: 400 });
    }

    const alreadyInTournament = await prisma.tournamentPlayer.findMany({
      where: {
        tournamentId,
        playerId: { in: playerIds }
      }
    });

    if (alreadyInTournament.length > 0) {
      return NextResponse.json({ error: "Algunos jugadores ya están en este torneo" }, { status: 400 });
    }

    // Añadir jugadores al torneo
    const tournamentPlayers = await Promise.all(
      playerIds.map(playerId =>
        prisma.tournamentPlayer.create({
          data: {
            tournamentId,
            playerId,
            joinedRound: joinRound,
            comodinesUsed: 0
          }
        })
      )
    );

    // Si se incorporan a una ronda futura que ya existe, añadirlos al grupo correspondiente
    await addPlayersToExistingRound(tournamentId, joinRound, playerIds);

    return NextResponse.json({
      success: true,
      addedPlayers: tournamentPlayers.length,
      message: `${tournamentPlayers.length} jugadores añadidos al torneo desde la ronda ${joinRound}`
    });

  } catch (error) {
    console.error("Error adding players to tournament:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// Quitar jugador del torneo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournamentId = params.id;
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');

    if (!playerId) {
      return NextResponse.json({ error: "ID del jugador requerido" }, { status: 400 });
    }

    // Verificar que el jugador está en el torneo
    const tournamentPlayer = await prisma.tournamentPlayer.findFirst({
      where: {
        tournamentId,
        playerId
      }
    });

    if (!tournamentPlayer) {
      return NextResponse.json({ error: "El jugador no está en este torneo" }, { status: 404 });
    }

    // Verificar si el jugador ya tiene partidos jugados
    const hasPlayedMatches = await prisma.match.findFirst({
      where: {
        OR: [
          { team1Player1Id: playerId },
          { team1Player2Id: playerId },
          { team2Player1Id: playerId },
          { team2Player2Id: playerId }
        ],
        isConfirmed: true,
        group: {
          round: {
            tournamentId
          }
        }
      }
    });

    if (hasPlayedMatches) {
      return NextResponse.json({ 
        error: "No se puede eliminar un jugador que ya ha jugado partidos confirmados" 
      }, { status: 400 });
    }

    // Eliminar al jugador del torneo y de grupos actuales
    await prisma.$transaction([
      // Quitar de grupos actuales
      prisma.groupPlayer.deleteMany({
        where: {
          playerId,
          group: {
            round: {
              tournamentId
            }
          }
        }
      }),
      // Quitar del torneo
      prisma.tournamentPlayer.delete({
        where: {
          tournamentId_playerId: {
            tournamentId,
            playerId
          }
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      message: "Jugador eliminado del torneo correctamente"
    });

  } catch (error) {
    console.error("Error removing player from tournament:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// Función auxiliar para añadir jugadores a ronda existente
async function addPlayersToExistingRound(tournamentId: string, roundNumber: number, playerIds: string[]) {
  // Buscar si la ronda ya existe
  const existingRound = await prisma.round.findFirst({
    where: {
      tournamentId,
      number: roundNumber
    },
    include: {
      groups: {
        include: {
          players: true
        },
        orderBy: { level: 'desc' } // Empezar por el grupo más bajo
      }
    }
  });

  if (!existingRound || existingRound.isClosed) {
    return; // No añadir a rondas que no existen o están cerradas
  }

  // Si es la ronda actual o futura, añadir jugadores al grupo más bajo
  if (existingRound.groups.length > 0) {
    const lowestGroup = existingRound.groups[0]; // Grupo de nivel más alto (numéricamente)
    
    // Añadir jugadores al grupo más bajo con posiciones altas
    let position = Math.max(...lowestGroup.players.map(p => p.position)) + 1;
    
    for (const playerId of playerIds) {
      await prisma.groupPlayer.create({
        data: {
          groupId: lowestGroup.id,
          playerId,
          position,
          points: 0,
          streak: 0
        }
      });
      position++;
    }

    // Regenerar matches para este grupo con los nuevos jugadores
    // Nota: Esto podría requerir lógica más compleja dependiendo de cuántos jugadores se añadan
    console.log(`Añadidos ${playerIds.length} jugadores al grupo ${lowestGroup.id} de la ronda ${roundNumber}`);
  }
}