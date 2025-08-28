import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.playerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { roundId, reason } = body;

    const playerId = session.user.playerId;

    // Verificar que el jugador no haya usado ya el comodín
    const tournamentPlayer = await prisma.tournamentPlayer.findFirst({
      where: {
        playerId,
        tournament: {
          rounds: {
            some: {
              id: roundId
            }
          }
        }
      },
      include: {
        tournament: true
      }
    });

    if (!tournamentPlayer) {
      return NextResponse.json({ error: "No estás inscrito en este torneo" }, { status: 400 });
    }

    if (tournamentPlayer.comodinesUsed >= 1) {
      return NextResponse.json({ error: "Ya has usado tu comodín en este torneo" }, { status: 400 });
    }

    // Verificar que la ronda no esté cerrada
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: true
      }
    });

    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    if (round.isClosed) {
      return NextResponse.json({ error: "No se puede usar comodín en ronda cerrada" }, { status: 400 });
    }

    // Buscar el grupo del jugador en esta ronda
    const groupPlayer = await prisma.groupPlayer.findFirst({
      where: {
        playerId,
        group: {
          roundId
        }
      },
      include: {
        group: {
          include: {
            players: {
              include: {
                player: true
              }
            }
          }
        }
      }
    });

    if (!groupPlayer) {
      return NextResponse.json({ error: "No estás asignado a ningún grupo en esta ronda" }, { status: 400 });
    }

    if (groupPlayer.usedComodin) {
      return NextResponse.json({ error: "Ya has usado comodín en esta ronda" }, { status: 400 });
    }

    // Calcular puntos del comodín
    let comodinPoints = 0;

    if (round.number <= 2) {
      // Rondas 1-2: media del grupo esa ronda
      const otherPlayers = groupPlayer.group.players.filter(p => p.playerId !== playerId);
      const totalPoints = otherPlayers.reduce((sum, p) => sum + p.points, 0);
      comodinPoints = otherPlayers.length > 0 ? totalPoints / otherPlayers.length : 0;
    } else {
      // Ronda 3+: media personal acumulada
      const playerStats = await prisma.$queryRaw<any[]>`
        SELECT AVG(gp.points) as averagePoints
        FROM group_players gp
        JOIN groups g ON gp.groupId = g.id
        JOIN rounds r ON g.roundId = r.id
        WHERE gp.playerId = ${playerId} 
        AND r.tournamentId = ${round.tournamentId}
        AND r.number < ${round.number}
        AND r.isClosed = true
        AND NOT gp.usedComodin
      `;

      comodinPoints = playerStats[0]?.averagePoints || 0;
    }

    // Aplicar el comodín
    await prisma.$transaction([
      // Marcar comodín usado en el grupo
      prisma.groupPlayer.update({
        where: { id: groupPlayer.id },
        data: {
          usedComodin: true,
          points: comodinPoints
        }
      }),
      // Incrementar contador de comodines usados en el torneo
      prisma.tournamentPlayer.update({
        where: {
          tournamentId_playerId: {
            tournamentId: round.tournamentId,
            playerId
          }
        },
        data: {
          comodinesUsed: { increment: 1 }
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      points: comodinPoints,
      message: `Comodín aplicado. Puntos asignados: ${comodinPoints.toFixed(1)}`
    });

  } catch (error) {
    console.error("Error applying comodin:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}