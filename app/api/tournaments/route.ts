import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";

export async function GET() {
  try {
    const tournaments = await prisma.tournament.findMany({
      include: {
        rounds: {
          select: {
            id: true,
            number: true,
            isClosed: true
          }
        },
        players: {
          include: {
            player: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(tournaments);
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { title, startDate, totalRounds, roundDurationDays, isPublic } = body;

    // Validaciones mejoradas
    if (!title || !startDate || !totalRounds || !roundDurationDays) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    if (totalRounds < 3 || totalRounds > 20) {
      return NextResponse.json({ error: "Las rondas deben estar entre 3 y 20" }, { status: 400 });
    }

    if (roundDurationDays < 7 || roundDurationDays > 30) {
      return NextResponse.json({ error: "Los días por ronda deben estar entre 7 y 30" }, { status: 400 });
    }

    if (new Date(startDate) <= new Date()) {
      return NextResponse.json({ error: "La fecha de inicio debe ser futura" }, { status: 400 });
    }

    // Verificar que no haya un torneo con el mismo nombre
    const existingTournament = await prisma.tournament.findFirst({
      where: { title: title.trim() }
    });

    if (existingTournament) {
      return NextResponse.json({ error: "Ya existe un torneo con ese nombre" }, { status: 400 });
    }

    // Crear el torneo
    const endDate = addDays(new Date(startDate), totalRounds * roundDurationDays);
    
    const tournament = await prisma.tournament.create({
      data: {
        title: title.trim(),
        startDate: new Date(startDate),
        endDate,
        totalRounds: Number(totalRounds),
        roundDurationDays: Number(roundDurationDays),
        isActive: true, // Activamos el torneo automáticamente
        isPublic: Boolean(isPublic),
      }
    });

    // Crear todas las rondas automáticamente
    const rounds = [];
    let currentStartDate = new Date(startDate);

    for (let i = 1; i <= totalRounds; i++) {
      const roundEndDate = addDays(currentStartDate, roundDurationDays);
      
      const round = await prisma.round.create({
        data: {
          tournamentId: tournament.id,
          number: i,
          startDate: currentStartDate,
          endDate: roundEndDate,
          isClosed: false
        }
      });
      
      rounds.push(round);
      currentStartDate = roundEndDate;
    }

    // Buscar jugadores disponibles (no en torneos activos)
    const availablePlayers = await prisma.player.findMany({
      where: {
        tournaments: {
          none: {
            tournament: {
              isActive: true,
              id: {
                not: tournament.id // Excluir este torneo que acabamos de crear
              }
            }
          }
        }
      }
    });

    let firstRoundCreated = false;
    let playersAdded = 0;

    if (availablePlayers.length >= 4) {
      // Solo agregar múltiplos de 4 jugadores para formar grupos completos
      const maxPlayers = Math.floor(availablePlayers.length / 4) * 4;
      const playersToAdd = availablePlayers.slice(0, maxPlayers);
      
      // Inscribir jugadores al torneo
      for (const player of playersToAdd) {
        await prisma.tournamentPlayer.create({
          data: {
            tournamentId: tournament.id,
            playerId: player.id,
            joinedRound: 1,
            comodinesUsed: 0
          }
        });
      }

      // Crear primera ronda con grupos y matches
      await createFirstRound(tournament.id, rounds[0].id, playersToAdd);
      firstRoundCreated = true;
      playersAdded = playersToAdd.length;
    }

    const result = {
      tournament,
      rounds: rounds.length,
      playersAdded,
      firstRoundCreated,
      message: firstRoundCreated 
        ? `Torneo creado con ${playersAdded} jugadores y primera ronda generada automáticamente`
        : "Torneo creado. Añade jugadores manualmente para comenzar."
    };

    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    console.error("Error creating tournament:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

async function createFirstRound(tournamentId: string, roundId: string, players: any[]) {
  // Distribución aleatoria
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  const numGroups = Math.floor(players.length / 4);

  for (let groupIndex = 0; groupIndex < numGroups; groupIndex++) {
    const group = await prisma.group.create({
      data: {
        roundId: roundId,
        number: groupIndex + 1,
        level: groupIndex + 1
      }
    });

    // Asignar 4 jugadores al grupo
    const groupPlayers = shuffledPlayers.slice(groupIndex * 4, (groupIndex + 1) * 4);
    const playersInGroup = [];

    for (let i = 0; i < 4; i++) {
      await prisma.groupPlayer.create({
        data: {
          groupId: group.id,
          playerId: groupPlayers[i].id,
          position: i + 1,
          points: 0,
          streak: 0
        }
      });

      playersInGroup.push({
        id: groupPlayers[i].id,
        position: i + 1
      });
    }

    // Generar matches automáticamente usando TournamentEngine
    await generateGroupMatches(group.id, playersInGroup);
  }
}

async function generateGroupMatches(groupId: string, players: { id: string, position: number }[]) {
  if (players.length !== 4) {
    console.warn(`Grupo ${groupId} no tiene exactamente 4 jugadores. Matches no generados.`);
    return;
  }

  const sortedPlayers = players.sort((a, b) => a.position - b.position);

  const matchConfigurations = [
    {
      setNumber: 1,
      team1: [sortedPlayers[0], sortedPlayers[3]], // #1 + #4
      team2: [sortedPlayers[1], sortedPlayers[2]]  // #2 + #3
    },
    {
      setNumber: 2,
      team1: [sortedPlayers[0], sortedPlayers[2]], // #1 + #3
      team2: [sortedPlayers[1], sortedPlayers[3]]  // #2 + #4
    },
    {
      setNumber: 3,
      team1: [sortedPlayers[0], sortedPlayers[1]], // #1 + #2
      team2: [sortedPlayers[2], sortedPlayers[3]]  // #3 + #4
    }
  ];

  for (const config of matchConfigurations) {
    await prisma.match.create({
      data: {
        groupId,
        setNumber: config.setNumber,
        team1Player1Id: config.team1[0].id,
        team1Player2Id: config.team1[1].id,
        team2Player1Id: config.team2[0].id,
        team2Player2Id: config.team2[1].id,
        team1Games: null,
        team2Games: null,
        tiebreakScore: null,
        isConfirmed: false,
        reportedById: null,
        confirmedById: null
      }
    });
  }
}