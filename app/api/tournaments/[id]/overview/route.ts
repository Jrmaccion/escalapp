// app/api/tournaments/[id]/overview/route.ts - CON DEBUG COMPLETO (TIPADO Y MICRO-FIXES)
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  withErrorHandling,
  requireAuth,
  createSuccessResponse,
  ApiErrorCode,
  throwApiError,
} from "@/lib/api-errors";

export const dynamic = "force-dynamic";

type PlayerInGroup = {
  playerId: string;
  name: string;
  position: number;
  points: number;
  streak: number;
  setsWon: number;
  gamesWon: number;
  gamesLost: number;
  h2hWins: number;
  isCurrentUser: boolean;
  movement: {
    type: "up" | "down" | "same";
    groups: number;
    description: string;
  };
};

type MatchResult = {
  id: string;
  setNumber: number;
  team1Player1Id: string;
  team1Player2Id: string;
  team2Player1Id: string;
  team2Player2Id: string;
  team1Games: number | null;
  team2Games: number | null;
  tiebreakScore: string | null;
  isConfirmed: boolean;
  status: string;
};

type GroupOverview = {
  groupId: string;
  groupNumber: number;
  level: number;
  players: PlayerInGroup[];
  matches: MatchResult[];
  scheduleStatus: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED";
  scheduledDate: string | null;
  completedSets: number;
  totalSets: number;
  needsAction: boolean;
  completionPercentage: number;
};

// Aux
function calculateH2H(playerId: string, matches: any[]): number {
  let h2hWins = 0;

  for (const match of matches) {
    if (match.team1Games === null || match.team2Games === null) continue;

    const isInTeam1 = [match.team1Player1Id, match.team1Player2Id].includes(playerId);
    const isInTeam2 = [match.team2Player1Id, match.team2Player2Id].includes(playerId);

    if (isInTeam1 && (match.team1Games || 0) > (match.team2Games || 0)) {
      h2hWins++;
    } else if (isInTeam2 && (match.team2Games || 0) > (match.team1Games || 0)) {
      h2hWins++;
    }
  }

  return h2hWins;
}

function calculatePlayerStats(playerId: string, matches: any[]) {
  let setsWon = 0;
  let gamesWon = 0;
  let gamesLost = 0;

  logger.debug("Calculando stats de jugador", { playerId, totalMatches: matches.length });

  for (const match of matches) {
    if (match.team1Games === null || match.team2Games === null) {
      logger.debug("Match sin resultados", { setNumber: match.setNumber });
      continue;
    }

    const isInTeam1 = [match.team1Player1Id, match.team1Player2Id].includes(playerId);
    const isInTeam2 = [match.team2Player1Id, match.team2Player2Id].includes(playerId);

    logger.debug("Procesando set", {
      setNumber: match.setNumber,
      isInTeam1,
      isInTeam2,
      score: `${match.team1Games}-${match.team2Games}`,
    });

    if (isInTeam1) {
      gamesWon += match.team1Games || 0;
      gamesLost += match.team2Games || 0;
      if ((match.team1Games || 0) > (match.team2Games || 0)) {
        setsWon++;
      }
    } else if (isInTeam2) {
      gamesWon += match.team2Games || 0;
      gamesLost += match.team1Games || 0;
      if ((match.team2Games || 0) > (match.team1Games || 0)) {
        setsWon++;
      }
    }
  }

  logger.debug("Stats finales calculadas", { playerId, setsWon, gamesWon, gamesLost });

  return { setsWon, gamesWon, gamesLost };
}

function calculateMovement(position: number, groupLevel: number, totalGroups: number) {
  const isTopGroup = groupLevel === 1;
  const isBottomGroup = groupLevel === totalGroups;
  const isSecondGroup = groupLevel === 2;
  const isPenultimateGroup = groupLevel === totalGroups - 1;

  switch (position) {
    case 1:
      if (isTopGroup) {
        return { type: "same" as const, groups: 0, description: "Se mantiene en grupo élite" };
      } else if (isSecondGroup) {
        return { type: "up" as const, groups: 1, description: "Sube al grupo élite" };
      } else {
        return { type: "up" as const, groups: 2, description: "Sube 2 grupos" };
      }
    case 2:
      if (isTopGroup) {
        return { type: "same" as const, groups: 0, description: "Se mantiene en grupo élite" };
      } else {
        return { type: "up" as const, groups: 1, description: "Sube 1 grupo" };
      }
    case 3:
      if (isBottomGroup) {
        return { type: "same" as const, groups: 0, description: "Se mantiene en grupo inferior" };
      } else {
        return { type: "down" as const, groups: 1, description: "Baja 1 grupo" };
      }
    case 4:
      if (isBottomGroup) {
        return { type: "same" as const, groups: 0, description: "Se mantiene en grupo inferior" };
      } else if (isPenultimateGroup) {
        return { type: "down" as const, groups: 1, description: "Baja al grupo inferior" };
      } else {
        return { type: "down" as const, groups: 2, description: "Baja 2 grupos" };
      }
    default:
      return { type: "same" as const, groups: 0, description: "Se mantiene" };
  }
}

function comparePlayersWithTiebreakers(
  a: { points: number; setsWon: number; gamesWon: number; gamesLost: number; h2hWins: number },
  b: { points: number; setsWon: number; gamesWon: number; gamesLost: number; h2hWins: number }
) {
  if (a.points !== b.points) return b.points - a.points;
  if (a.setsWon !== b.setsWon) return b.setsWon - a.setsWon;

  const aDiff = a.gamesWon - a.gamesLost;
  const bDiff = b.gamesWon - b.gamesLost;
  if (aDiff !== bDiff) return bDiff - aDiff;
  if (a.h2hWins !== b.h2hWins) return b.h2hWins - a.h2hWins;
  if (a.gamesWon !== b.gamesWon) return b.gamesWon - a.gamesWon;

  return 0;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withErrorHandling(async () => {
    const session = await getServerSession(authOptions);
    requireAuth(session);

    const tournamentId = params.id;
    const userId = session.user.id;
    const isAdmin = (session.user as any).isAdmin || false; // <- micro-guard por si no existe en el tipo

    logger.apiRequest("GET", `/api/tournaments/${tournamentId}/overview`, { userId, isAdmin });

    let playerId: string | null = null;

    if (!isAdmin) {
      const player = await prisma.player.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!player) {
        throwApiError(ApiErrorCode.NOT_FOUND, "No se encontró perfil de jugador asociado a tu cuenta");
      }

      playerId = player.id;

      const tournamentPlayer = await prisma.tournamentPlayer.findUnique({
        where: {
          tournamentId_playerId: { tournamentId, playerId },
        },
      });

      if (!tournamentPlayer) {
        throwApiError(ApiErrorCode.FORBIDDEN, "No tienes acceso a este torneo");
      }
    } else {
      const player = await prisma.player.findUnique({
        where: { userId },
        select: { id: true },
      });
      playerId = player?.id || null;
      logger.debug("Admin playerId", { playerId: playerId || "ninguno" });
    }

    // Carga selectiva para reducir payload
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        title: true,
        totalRounds: true,
        rounds: {
          where: { isClosed: false },
          orderBy: { number: "asc" },
          take: 1,
          select: {
            id: true,
            number: true,
            groups: {
              select: {
                id: true,
                number: true,
                level: true,
                players: {
                  select: {
                    playerId: true,
                    points: true,
                    streak: true,
                    position: true,
                    player: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                  orderBy: { points: "desc" },
                },
                matches: {
                  select: {
                    id: true,
                    setNumber: true,
                    team1Player1Id: true,
                    team1Player2Id: true,
                    team2Player1Id: true,
                    team2Player2Id: true,
                    team1Games: true,
                    team2Games: true,
                    tiebreakScore: true,
                    isConfirmed: true,
                    status: true,
                    proposedDate: true,
                    acceptedDate: true,
                    acceptedBy: true,
                    proposedById: true,
                  },
                },
              },
              orderBy: { level: "asc" },
            },
          },
        },
      },
    });

    if (!tournament) {
      throwApiError(ApiErrorCode.NOT_FOUND, "Torneo no encontrado");
    }

    if (!tournament.rounds.length) {
      logger.debug("Torneo sin rondas activas", { tournamentId });
      return createSuccessResponse({
        tournamentId: tournament.id,
        tournamentTitle: tournament.title,
        currentRound: null,
        totalRounds: tournament.totalRounds,
        groups: [],
        stats: {
          totalGroups: 0,
          scheduledGroups: 0,
          completedGroups: 0,
          userPendingActions: 0,
          averageCompletion: 0,
        },
        userCurrentGroupId: null,
        hasActiveRound: false,
        message: "No hay rondas activas en este torneo",
      });
    }

    const currentRound = tournament.rounds[0];

    const totalMatches = currentRound.groups.reduce((sum, g) => sum + g.matches.length, 0);
    logger.debug("Ronda actual cargada", {
      roundNumber: currentRound.number,
      groupsCount: currentRound.groups.length,
      totalMatches,
    });

    logger.debug("Grupos cargados", {
      groups: currentRound.groups.map((g) => ({
        number: g.number,
        id: g.id,
        matchesWithResults: g.matches.filter((m) => m.team1Games !== null && m.team2Games !== null).length,
        totalMatches: g.matches.length,
      })),
    });

    let userCurrentGroupId: string | undefined;
    const totalGroups = currentRound.groups.length;

    logger.debug("Procesando grupos", { roundNumber: currentRound.number, totalGroups });

    const groups: GroupOverview[] = currentRound.groups.map((group) => {
      logger.debug(`Procesando grupo ${group.number}`, {
        matchesCount: group.matches.length,
        players: group.players.map((gp) => ({
          name: gp.player.name,
          playerId: gp.playerId,
          points: gp.points,
        })),
        matches: group.matches.map((match) => ({
          setNumber: match.setNumber,
          score: `${match.team1Games}-${match.team2Games}`,
          confirmed: match.isConfirmed,
          status: match.status,
        })),
      });

      const playersWithStats = group.players.map((gp) => {
        const stats = calculatePlayerStats(gp.playerId, group.matches);
        const h2hWins = calculateH2H(gp.playerId, group.matches);

        const result = {
          playerId: gp.playerId,
          name: gp.player.name,
          points: gp.points || 0,
          streak: gp.streak || 0,
          setsWon: stats.setsWon,
          gamesWon: stats.gamesWon,
          gamesLost: stats.gamesLost,
          h2hWins,
          isCurrentUser: playerId ? gp.playerId === playerId : false,
        };

        logger.debug("Stats calculadas para jugador", { name: gp.player.name, stats: result });

        return result;
      });

      playersWithStats.sort(comparePlayersWithTiebreakers);

      if (playerId) {
        const userInGroup = playersWithStats.find((p) => p.isCurrentUser);
        if (userInGroup) {
          userCurrentGroupId = group.id;
        }
      }

      const players: PlayerInGroup[] = playersWithStats.map((player, index) => {
        const position = index + 1;
        const movement = calculateMovement(position, group.level, totalGroups);

        logger.debug("Jugador procesado", {
          groupNumber: group.number,
          name: player.name,
          position,
          points: player.points,
          setsWon: player.setsWon,
          gamesDiff: `${player.gamesWon}-${player.gamesLost}`,
        });

        return {
          ...player,
          position,
          movement,
        };
      });

      // Estado de agenda y progreso
      let scheduleStatus: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED" = "PENDING";
      let scheduledDate: string | null = null;

      const firstMatch = group.matches[0];
      if (firstMatch) {
        if (firstMatch.acceptedDate) {
          scheduleStatus = "SCHEDULED";
          // toISOString defensivo (por si viene como Date | string)
          scheduledDate =
            firstMatch.acceptedDate instanceof Date
              ? firstMatch.acceptedDate.toISOString()
              : new Date(firstMatch.acceptedDate as any).toISOString();
        } else if (firstMatch.proposedDate) {
          scheduleStatus = "DATE_PROPOSED";
        }
      }

      const completedSets = group.matches.filter((m) => m.isConfirmed).length;
      const totalSets = group.matches.length;

      const setsWithResults = group.matches.filter((m) => m.team1Games !== null && m.team2Games !== null).length;

      const completionPercentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
      const resultsPercentage = totalSets > 0 ? Math.round((setsWithResults / totalSets) * 100) : 0;

      logger.debug("Progreso del grupo", {
        groupNumber: group.number,
        completedSets,
        totalSets,
        completionPercentage,
        setsWithResults,
        resultsPercentage,
      });

      if (completedSets === totalSets && totalSets > 0) {
        scheduleStatus = "COMPLETED";
      }

      // ¿Necesita acción del usuario?
      let needsAction = false;
      if (playerId) {
        const userInGroup = playersWithStats.find((p) => p.isCurrentUser);
        if (userInGroup) {
          if (firstMatch?.proposedDate && firstMatch.status === "DATE_PROPOSED") {
            const userAccepted = (firstMatch.acceptedBy || []).includes(userId);
            const proposedByUser = firstMatch.proposedById === userId;
            needsAction = !userAccepted && !proposedByUser;
          }

          const userMatches = group.matches.filter((match) =>
            [match.team1Player1Id, match.team1Player2Id, match.team2Player1Id, match.team2Player2Id].includes(
              playerId
            )
          );

          const pendingUserMatches = userMatches.filter(
            (match) => !match.isConfirmed && match.team1Games === null && match.team2Games === null
          );

          if (pendingUserMatches.length > 0) {
            needsAction = true;
          }
        }
      }

      const matches: MatchResult[] = group.matches.map((match) => ({
        id: match.id,
        setNumber: match.setNumber,
        team1Player1Id: match.team1Player1Id,
        team1Player2Id: match.team1Player2Id,
        team2Player1Id: match.team2Player1Id,
        team2Player2Id: match.team2Player2Id,
        team1Games: match.team1Games,
        team2Games: match.team2Games,
        tiebreakScore: match.tiebreakScore,
        isConfirmed: match.isConfirmed,
        status: match.status,
      }));

      return {
        groupId: group.id,
        groupNumber: group.number,
        level: group.level || group.number,
        players,
        matches,
        scheduleStatus,
        scheduledDate,
        completedSets,
        totalSets,
        needsAction,
        completionPercentage,
      };
    });

    const stats = {
      totalGroups: groups.length,
      scheduledGroups: groups.filter((g) => g.scheduleStatus === "SCHEDULED").length,
      completedGroups: groups.filter((g) => g.scheduleStatus === "COMPLETED").length,
      userPendingActions: groups.filter((g) => g.needsAction).length,
      averageCompletion:
        groups.length > 0
          ? Math.round(groups.reduce((sum, g) => sum + g.completionPercentage, 0) / groups.length)
          : 0,
    };

    const response = {
      tournamentId,
      tournamentTitle: tournament.title,
      currentRound: currentRound.number,
      totalRounds: tournament.totalRounds,
      groups,
      userCurrentGroupId: userCurrentGroupId || null,
      stats,
    };

    logger.debug("Respuesta preparada", {
      groupsCount: groups.length,
      averageCompletion: stats.averageCompletion,
      firstPlayerExample: groups[0]?.players[0],
    });

    return createSuccessResponse(response);
  });
}
