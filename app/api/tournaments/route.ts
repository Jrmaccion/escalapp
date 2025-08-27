import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";

/**
 * GET /api/tournaments
 * Devuelve el listado de torneos con información básica.
 */
export async function GET() {
  try {
    const tournaments = await prisma.tournament.findMany({
      include: {
        rounds: {
          select: { id: true, number: true, isClosed: true },
        },
        players: {
          include: {
            player: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tournaments);
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * POST /api/tournaments
 * Crea un torneo, sus rondas y (si hay >=4 jugadores libres) genera la Ronda 1 con grupos y partidos.
 * IMPORTANTE: La respuesta ahora devuelve solo { id } para simplificar el redirect del cliente.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { title, startDate, totalRounds, roundDurationDays, isPublic } = body as {
      title: string;
      startDate: string;         // YYYY-MM-DD
      totalRounds: number;
      roundDurationDays: number;
      isPublic: boolean;
    };

    // Validaciones
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

    // Nombre único (opcional)
    const existingTournament = await prisma.tournament.findFirst({
      where: { title: title.trim() },
    });
    if (existingTournament) {
      return NextResponse.json({ error: "Ya existe un torneo con ese nombre" }, { status: 400 });
    }

    // Crear torneo
    const start = new Date(startDate);
    const end = addDays(start, totalRounds * roundDurationDays);

    const tournament = await prisma.tournament.create({
      data: {
        title: title.trim(),
        startDate: start,
        endDate: end,
        totalRounds: Number(totalRounds),
        roundDurationDays: Number(roundDurationDays),
        isActive: true,
        isPublic: Boolean(isPublic),
      },
    });

    // Crear todas las rondas
    const rounds = [];
    let currentStartDate = new Date(start);

    for (let i = 1; i <= totalRounds; i++) {
      const roundEndDate = addDays(currentStartDate, roundDurationDays);

      const round = await prisma.round.create({
        data: {
          tournamentId: tournament.id,
          number: i,
          startDate: currentStartDate,
          endDate: roundEndDate,
          isClosed: false,
        },
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
              id: { not: tournament.id },
            },
          },
        },
      },
    });

    // Si hay al menos 4, inscribir múltiplos de 4 y generar primera ronda
    if (availablePlayers.length >= 4) {
      const maxPlayers = Math.floor(availablePlayers.length / 4) * 4;
      const playersToAdd = availablePlayers.slice(0, maxPlayers);

      for (const player of playersToAdd) {
        await prisma.tournamentPlayer.create({
          data: {
            tournamentId: tournament.id,
            playerId: player.id,
            joinedRound: 1,
            comodinesUsed: 0,
          },
        });
      }

      await createFirstRound(tournament.id, rounds[0].id, playersToAdd);
    }

    // ✅ Respuesta simplificada para el redirect del cliente
    return NextResponse.json({ id: tournament.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating tournament:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * Crea grupos (de 4) aleatorios y los 3 partidos de la rotación fija por grupo.
 */
async function createFirstRound(tournamentId: string, roundId: string, players: any[]) {
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  const numGroups = Math.floor(players.length / 4);

  for (let groupIndex = 0; groupIndex < numGroups; groupIndex++) {
    const group = await prisma.group.create({
      data: {
        roundId,
        number: groupIndex + 1,
        level: groupIndex + 1,
      },
    });

    const groupPlayers = shuffledPlayers.slice(groupIndex * 4, (groupIndex + 1) * 4);
    const playersInGroup: { id: string; position: number }[] = [];

    for (let i = 0; i < 4; i++) {
      await prisma.groupPlayer.create({
        data: {
          groupId: group.id,
          playerId: groupPlayers[i].id,
          position: i + 1,
          points: 0,
          streak: 0,
        },
      });
      playersInGroup.push({ id: groupPlayers[i].id, position: i + 1 });
    }

    await generateGroupMatches(group.id, playersInGroup);
  }
}

/**
 * Genera los 3 partidos según la rotación:
 * 1) #1 + #4 vs #2 + #3
 * 2) #1 + #3 vs #2 + #4
 * 3) #1 + #2 vs #3 + #4
 */
async function generateGroupMatches(groupId: string, players: { id: string; position: number }[]) {
  if (players.length !== 4) {
    console.warn(`Grupo ${groupId} no tiene exactamente 4 jugadores. Matches no generados.`);
    return;
  }

  const sortedPlayers = [...players].sort((a, b) => a.position - b.position);

  const matchConfigurations = [
    {
      setNumber: 1,
      team1: [sortedPlayers[0], sortedPlayers[3]], // #1 + #4
      team2: [sortedPlayers[1], sortedPlayers[2]], // #2 + #3
    },
    {
      setNumber: 2,
      team1: [sortedPlayers[0], sortedPlayers[2]], // #1 + #3
      team2: [sortedPlayers[1], sortedPlayers[3]], // #2 + #4
    },
    {
      setNumber: 3,
      team1: [sortedPlayers[0], sortedPlayers[1]], // #1 + #2
      team2: [sortedPlayers[2], sortedPlayers[3]], // #3 + #4
    },
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
        confirmedById: null,
      },
    });
  }
}
