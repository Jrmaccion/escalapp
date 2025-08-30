// app/api/player/group/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.playerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const playerId = session.user.playerId;

    // Obtener grupo actual del jugador
    const currentGroupPlayer = await prisma.groupPlayer.findFirst({
      where: {
        playerId,
        group: {
          round: {
            tournament: { isActive: true },
            isClosed: false
          }
        }
      },
      include: {
        group: {
          include: {
            round: {
              include: {
                tournament: {
                  select: { title: true }
                }
              }
            },
            players: {
              include: { player: true },
              orderBy: { position: 'asc' }
            }
          }
        }
      }
    });

    if (!currentGroupPlayer) {
      return NextResponse.json({
        hasGroup: false,
        message: "No estás asignado a ningún grupo en el torneo activo"
      });
    }

    const group = currentGroupPlayer.group;

    // Obtener próximos partidos del jugador
    const upcomingMatches = await prisma.match.findMany({
      where: {
        groupId: group.id,
        OR: [
          { team1Player1Id: playerId },
          { team1Player2Id: playerId },
          { team2Player1Id: playerId },
          { team2Player2Id: playerId }
        ],
        isConfirmed: false
      },
      orderBy: { setNumber: 'asc' }
    });

    // Obtener nombres para los próximos partidos
    const matchesWithNames = await Promise.all(
      upcomingMatches.map(async (match) => {
        const [team1Player1, team1Player2, team2Player1, team2Player2] = await Promise.all([
          prisma.player.findUnique({ where: { id: match.team1Player1Id }, select: { name: true } }),
          prisma.player.findUnique({ where: { id: match.team1Player2Id }, select: { name: true } }),
          prisma.player.findUnique({ where: { id: match.team2Player1Id }, select: { name: true } }),
          prisma.player.findUnique({ where: { id: match.team2Player2Id }, select: { name: true } })
        ]);

        // Determinar quién es mi compañero
        let partner = '';
        let opponents: string[] = [];

        if (match.team1Player1Id === playerId) {
          partner = team1Player2?.name || '';
          opponents = [team2Player1?.name || '', team2Player2?.name || ''];
        } else if (match.team1Player2Id === playerId) {
          partner = team1Player1?.name || '';
          opponents = [team2Player1?.name || '', team2Player2?.name || ''];
        } else if (match.team2Player1Id === playerId) {
          partner = team2Player2?.name || '';
          opponents = [team1Player1?.name || '', team1Player2?.name || ''];
        } else {
          partner = team2Player1?.name || '';
          opponents = [team1Player1?.name || '', team1Player2?.name || ''];
        }

        return {
          id: match.id,
          setNumber: match.setNumber,
          partner,
          opponents,
          hasResult: match.team1Games !== null && match.team2Games !== null,
          isPending: match.reportedById !== null && !match.isConfirmed
        };
      })
    );

    // Determinar nivel del grupo basado en su level
    const getLevelName = (level: number) => {
      if (level === 1) return "Superior";
      if (level <= 3) return "Intermedio";
      return "Inicial";
    };

    return NextResponse.json({
      hasGroup: true,
      tournament: {
        title: group.round.tournament.title,
        currentRound: group.round.number
      },
      group: {
        number: group.number,
        level: getLevelName(group.level),
        totalPlayers: group.players.length
      },
      myStatus: {
        position: currentGroupPlayer.position,
        points: currentGroupPlayer.points,
        streak: currentGroupPlayer.streak
      },
      players: group.players.map(gp => ({
        id: gp.playerId,
        name: gp.player.name,
        points: gp.points,
        position: gp.position,
        isCurrentUser: gp.playerId === playerId
      })),
      nextMatches: matchesWithNames.filter(m => !m.hasResult)
    });

  } catch (error) {
    console.error("Error in player group API:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}