// app/api/tournaments/[id]/overview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tournamentId = params.id;
    const userId = session.user.id;

    console.log(`[GET /api/tournaments/${tournamentId}/overview] Usuario: ${userId}`);

    // Obtener playerId del usuario
    const player = await prisma.player.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!player) {
      return NextResponse.json({ error: "No hay jugador asociado" }, { status: 401 });
    }

    const playerId = player.id;

    // Verificar que el usuario participa en el torneo
    const tournamentPlayer = await prisma.tournamentPlayer.findUnique({
      where: {
        tournamentId_playerId: { tournamentId, playerId }
      }
    });

    if (!tournamentPlayer) {
      return NextResponse.json({ error: "No participas en este torneo" }, { status: 403 });
    }

    // Obtener información del torneo y ronda actual
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        rounds: {
          where: { isClosed: false },
          orderBy: { number: "asc" },
          take: 1,
          include: {
            groups: {
              include: {
                players: {
                  include: { player: { include: { user: true } } },
                  orderBy: { points: "desc" }
                },
                matches: {
                  select: {
                    id: true,
                    status: true,
                    proposedDate: true,
                    acceptedDate: true,
                    acceptedBy: true,
                    proposedById: true,
                    isConfirmed: true,
                    team1Games: true,
                    team2Games: true,
                    team1Player1Id: true,
                    team1Player2Id: true,
                    team2Player1Id: true,
                    team2Player2Id: true
                  }
                }
              },
              orderBy: { number: "asc" }
            }
          }
        }
      }
    });

    if (!tournament) {
      return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
    }

    if (!tournament.rounds.length) {
      return NextResponse.json({ error: "No hay rondas activas en este torneo" }, { status: 404 });
    }

    const currentRound = tournament.rounds[0];
    let userCurrentGroupId: string | undefined;

    // Procesar información de todos los grupos
    const groups = currentRound.groups.map(group => {
      // Identificar si el usuario actual está en este grupo
      const userInGroup = group.players.find(gp => gp.playerId === playerId);
      if (userInGroup) {
        userCurrentGroupId = group.id;
      }

      // Calcular estado de programación del grupo
      let scheduleStatus: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED" = "PENDING";
      let scheduledDate: string | null = null;
      
      const firstMatch = group.matches[0];
      if (firstMatch) {
        if (firstMatch.acceptedDate) {
          scheduleStatus = "SCHEDULED";
          scheduledDate = firstMatch.acceptedDate.toISOString();
        } else if (firstMatch.proposedDate) {
          scheduleStatus = "DATE_PROPOSED";
        }
      }

      // Verificar si todos los sets están completados
      const completedSets = group.matches.filter(m => m.isConfirmed).length;
      const totalSets = group.matches.length;
      
      if (completedSets === totalSets && totalSets > 0) {
        scheduleStatus = "COMPLETED";
      }

      // Determinar si el usuario tiene acciones pendientes en este grupo
      let needsAction = false;
      if (userInGroup) {
        // Verificar si hay propuesta de fecha pendiente de respuesta del usuario
        if (firstMatch?.proposedDate && firstMatch.status === "DATE_PROPOSED") {
          const userAccepted = (firstMatch.acceptedBy || []).includes(userId);
          const proposedByUser = firstMatch.proposedById === userId;
          needsAction = !userAccepted && !proposedByUser;
        }

        // Verificar si hay sets sin jugar donde participa el usuario
        const userMatches = group.matches.filter(match => 
          [match.team1Player1Id, match.team1Player2Id, match.team2Player1Id, match.team2Player2Id]
            .includes(playerId)
        );
        
        const pendingUserMatches = userMatches.filter(match => 
          !match.isConfirmed && match.team1Games === null && match.team2Games === null
        );
        
        if (pendingUserMatches.length > 0) {
          needsAction = true;
        }
      }

      // Formatear jugadores con posiciones reales basadas en puntos
      const players = group.players.map((gp, index) => ({
        playerId: gp.playerId,
        name: gp.player.name,
        position: index + 1, // Posición real basada en ordenamiento por puntos
        points: gp.points || 0,
        streak: gp.streak || 0,
        isCurrentUser: gp.playerId === playerId
      }));

      return {
        groupId: group.id,
        groupNumber: group.number,
        level: group.level || group.number,
        players,
        scheduleStatus,
        scheduledDate,
        completedSets,
        totalSets,
        needsAction
      };
    });

    // Calcular estadísticas generales
    const stats = {
      totalGroups: groups.length,
      scheduledGroups: groups.filter(g => g.scheduleStatus === "SCHEDULED").length,
      completedGroups: groups.filter(g => g.scheduleStatus === "COMPLETED").length,
      userPendingActions: groups.filter(g => g.needsAction).length
    };

    const response = {
      tournamentId,
      tournamentTitle: tournament.title,
      currentRound: currentRound.number,
      totalRounds: tournament.totalRounds,
      groups,
      userCurrentGroupId,
      stats
    };

    console.log(`[GET /api/tournaments/${tournamentId}/overview] Respuesta generada: ${groups.length} grupos`);

    return NextResponse.json(response);

  } catch (error) {
    console.error(`[GET /api/tournaments/${params.id}/overview] Error:`, error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}