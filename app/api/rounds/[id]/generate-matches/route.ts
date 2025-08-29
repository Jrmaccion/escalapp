import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type RouteParams = { params: { id: string } };

export async function POST(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roundId = params.id;
  const { force } = (await req.json().catch(() => ({}))) as { force?: boolean };

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      groups: {
        include: {
          players: { 
            select: { playerId: true, position: true },
            orderBy: { position: 'asc' }
          },
          matches: true,
        },
        orderBy: { number: 'asc' }
      },
    },
  });

  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
  if (round.isClosed) {
    return NextResponse.json({ error: "Round is closed" }, { status: 400 });
  }

  const tx: any[] = [];
  let totalCreated = 0;
  let totalDeleted = 0;
  let groupsProcessed = 0;
  let groupsSkipped = 0;

  for (const group of round.groups) {
    // Verificar si el grupo tiene partidos existentes
    if (group.matches.length > 0) {
      if (force) {
        tx.push(prisma.match.deleteMany({ where: { groupId: group.id } }));
        totalDeleted += group.matches.length;
      } else {
        groupsSkipped++;
        continue;
      }
    }

    // Verificar que el grupo tenga exactamente 4 jugadores
    if (group.players.length !== 4) {
      console.warn(`Grupo ${group.number} tiene ${group.players.length} jugadores, se necesitan 4`);
      groupsSkipped++;
      continue;
    }

    const playerIds = group.players.map(p => p.playerId);

    // Generar los 3 sets con rotación completa
    const matchSchedules = [
      // Set 1: (1º + 4º) vs (2º + 3º)
      {
        setNumber: 1,
        team1Player1Id: playerIds[0], // 1º puesto
        team1Player2Id: playerIds[3], // 4º puesto  
        team2Player1Id: playerIds[1], // 2º puesto
        team2Player2Id: playerIds[2], // 3º puesto
      },
      // Set 2: (1º + 3º) vs (2º + 4º)
      {
        setNumber: 2,
        team1Player1Id: playerIds[0], // 1º puesto
        team1Player2Id: playerIds[2], // 3º puesto
        team2Player1Id: playerIds[1], // 2º puesto
        team2Player2Id: playerIds[3], // 4º puesto
      },
      // Set 3: (1º + 2º) vs (3º + 4º)
      {
        setNumber: 3,
        team1Player1Id: playerIds[0], // 1º puesto
        team1Player2Id: playerIds[1], // 2º puesto
        team2Player1Id: playerIds[2], // 3º puesto
        team2Player2Id: playerIds[3], // 4º puesto
      }
    ];

    // Crear los partidos para este grupo
    const matchData = matchSchedules.map(schedule => ({
      groupId: group.id,
      ...schedule,
      // Estados iniciales
      status: 'PENDING' as const,
      team1Games: null,
      team2Games: null,
      tiebreakScore: null,
      isConfirmed: false,
      reportedById: null,
      confirmedById: null,
      photoUrl: null,
      proposedDate: null,
      proposedById: null,
      acceptedDate: null,
      acceptedBy: [],
    }));

    tx.push(prisma.match.createMany({ 
      data: matchData,
      skipDuplicates: true 
    }));
    
    totalCreated += matchData.length;
    groupsProcessed++;
  }

  try {
    if (tx.length > 0) {
      await prisma.$transaction(tx);
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalCreated,
        totalDeleted,
        groupsProcessed,
        groupsSkipped,
        totalGroups: round.groups.length
      },
      message: totalCreated === 0
        ? `No se generaron partidos. ${groupsSkipped} grupos omitidos (ya tenían partidos o no tienen 4 jugadores).`
        : `Generados ${totalCreated} partidos en ${groupsProcessed} grupos.${totalDeleted ? ` Eliminados ${totalDeleted} partidos anteriores.` : ''}${groupsSkipped ? ` ${groupsSkipped} grupos omitidos.` : ''}`
    });
  } catch (error) {
    console.error("Error generating matches:", error);
    return NextResponse.json({ 
      error: "Error generando partidos", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

// GET para obtener vista global de partidos
export async function GET(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roundId = params.id;
  
  try {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        groups: {
          include: {
            players: {
              include: {
                player: true
              },
              orderBy: { position: 'asc' }
            },
            matches: {
              include: {
                proposer: {
                  select: { name: true, email: true }
                }
              },
              orderBy: { setNumber: 'asc' }
            }
          },
          orderBy: { number: 'asc' }
        },
        tournament: {
          select: { title: true }
        }
      }
    });

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    // Calcular estadísticas
    const totalMatches = round.groups.reduce((acc, group) => acc + group.matches.length, 0);
    const completedMatches = round.groups.reduce((acc, group) => 
      acc + group.matches.filter(m => m.isConfirmed).length, 0
    );
    const scheduledMatches = round.groups.reduce((acc, group) => 
      acc + group.matches.filter(m => m.status === 'SCHEDULED').length, 0
    );
    const pendingDates = round.groups.reduce((acc, group) => 
      acc + group.matches.filter(m => m.status === 'PENDING').length, 0
    );
    const proposedDates = round.groups.reduce((acc, group) => 
      acc + group.matches.filter(m => m.status === 'DATE_PROPOSED').length, 0
    );

    return NextResponse.json({
      round: {
        id: round.id,
        number: round.number,
        startDate: round.startDate,
        endDate: round.endDate,
        isClosed: round.isClosed,
        tournament: round.tournament
      },
      groups: round.groups.map(group => ({
        id: group.id,
        number: group.number,
        level: group.level,
        players: group.players.map(gp => ({
          id: gp.player.id,
          name: gp.player.name,
          position: gp.position,
          points: gp.points
        })),
        matches: group.matches.map(match => ({
          id: match.id,
          setNumber: match.setNumber,
          status: match.status,
          proposedDate: match.proposedDate,
          acceptedDate: match.acceptedDate,
          proposedBy: match.proposer?.name,
          acceptedCount: match.acceptedBy?.length || 0,
          team1Player1Id: match.team1Player1Id,
          team1Player2Id: match.team1Player2Id,
          team2Player1Id: match.team2Player1Id,
          team2Player2Id: match.team2Player2Id,
          team1Games: match.team1Games,
          team2Games: match.team2Games,
          tiebreakScore: match.tiebreakScore,
          isConfirmed: match.isConfirmed
        }))
      })),
      stats: {
        totalMatches,
        completedMatches,
        scheduledMatches,
        pendingDates,
        proposedDates,
        completionRate: totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
      }
    });
  } catch (error) {
    console.error("Error fetching round matches:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}