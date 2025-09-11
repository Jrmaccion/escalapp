// lib/comodin.server.ts - Solo para uso en server (API routes, etc.)
// Contiene todas las funciones que usan Prisma

import { prisma } from "@/lib/prisma";

// ==============================
// TIPOS PRINCIPALES (compartidos)
// ==============================

export type ComodinResult = { success: boolean; message: string };

export type ComodinStatus = {
  used: boolean;
  usedAt: string | null;
  reason: string | null;
  tournamentId: string;
  roundId: string;
  playerId: string;
  comodinesUsedInTournament: number;
  comodinesRemainingInTournament: number;
  canUse: boolean;
  canRevoke: boolean;
  restrictionReason?: string | null;
  mode?: "mean" | "substitute" | null;
  points?: number;
  substitutePlayer?: string | null;
  appliedAt?: string | null;
  tournamentInfo?: {
    maxComodines: number;
    comodinesUsed: number;
    comodinesRemaining: number;
    enableMeanComodin?: boolean;
    enableSubstituteComodin?: boolean;
  };
  restrictions?: {
    hasConfirmedMatches: boolean;
    hasUpcomingMatches: boolean;
    roundClosed: boolean;
  };
};

export type PlayerComodinStatus = {
  playerId: string;
  playerName: string;
  groupNumber: number;
  usedComodin: boolean;
  comodinMode?: "substitute" | "mean";
  substitutePlayerName?: string | null;
  points: number;
  comodinReason?: string | null;
  appliedAt?: string | null;
  canRevoke: boolean;
  restrictionReason?: string | null;
};

export type RoundComodinStats = {
  roundId: string;
  totalPlayers: number;
  withComodin: number;
  revocables: number;
  players: PlayerComodinStatus[];
};

// ==============================
// FUNCIONES PRINCIPALES
// ==============================

/**
 * Marca el comodín para un jugador en una ronda.
 */
export async function useComodin(
  playerId: string,
  roundId: string,
  reason: string
): Promise<ComodinResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const gp = await tx.groupPlayer.findFirst({
        where: {
          playerId,
          group: { roundId },
        },
        include: {
          group: {
            include: {
              round: true,
            },
          },
        },
      });

      if (!gp) {
        return {
          success: false,
          message: "El jugador no está asignado a ningún grupo en esta ronda.",
        };
      }
      if (gp.usedComodin) {
        return {
          success: false,
          message: "El jugador ya tiene aplicado el comodín en esta ronda.",
        };
      }

      const tournamentId = gp.group.round.tournamentId;

      const usedCountInTournament = await tx.groupPlayer.count({
        where: {
          playerId,
          usedComodin: true,
          group: {
            round: {
              tournamentId,
            },
          },
        },
      });

      if (usedCountInTournament > 0) {
        return {
          success: false,
          message: "Comodín ya consumido en este torneo.",
        };
      }

      await tx.groupPlayer.update({
        where: {
          groupId_playerId: { groupId: gp.groupId, playerId },
        },
        data: {
          usedComodin: true,
          comodinReason: reason?.slice(0, 200) || "Comodín aplicado",
          comodinAt: new Date(),
        },
      });

      return {
        success: true,
        message: "Comodín aplicado correctamente.",
      };
    });
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Error aplicando comodín" };
  }
}

/**
 * Revoca el comodín del jugador en la ronda dada.
 */
export async function revokeComodin(
  playerId: string,
  roundId: string
): Promise<ComodinResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const gp = await tx.groupPlayer.findFirst({
        where: {
          playerId,
          group: { roundId },
        },
        select: { groupId: true, playerId: true, usedComodin: true },
      });

      if (!gp) {
        return { success: false, message: "El jugador no está asignado a esta ronda." };
      }
      if (!gp.usedComodin) {
        return { success: false, message: "El jugador no tiene comodín aplicado en esta ronda." };
      }

      await tx.groupPlayer.update({
        where: {
          groupId_playerId: { groupId: gp.groupId, playerId },
        },
        data: {
          usedComodin: false,
          comodinReason: null,
          comodinAt: null,
        },
      });

      return { success: true, message: "Comodín revocado correctamente." };
    });
  } catch (error: any) {
    return { success: false, message: error?.message ?? "Error revocando comodín" };
  }
}

/**
 * Devuelve el estado completo del comodín para un jugador en una ronda
 * Con todas las validaciones y restricciones
 */
export async function getComodinStatus(
  playerId: string,
  roundId: string
): Promise<ComodinStatus | null> {
  try {
    const gp = await prisma.groupPlayer.findFirst({
      where: {
        playerId,
        group: { roundId },
      },
      include: {
        group: {
          include: { 
            round: {
              include: {
                tournament: {
                  select: {
                    id: true,
                    maxComodinesPerPlayer: true,
                    enableMeanComodin: true,
                    enableSubstituteComodin: true,
                  }
                }
              }
            },
            matches: {
              where: {
                OR: [
                  { team1Player1Id: playerId },
                  { team1Player2Id: playerId },
                  { team2Player1Id: playerId },
                  { team2Player2Id: playerId },
                ],
              },
              select: {
                id: true,
                proposedDate: true,
                acceptedDate: true,
                status: true,
                isConfirmed: true,
              },
            },
          },
        },
        player: {
          select: {
            name: true,
          }
        }
      },
    });

    if (!gp) return null;

    const tournament = gp.group.round.tournament;
    const round = gp.group.round;
    
    // Contar comodines usados en el torneo
    const tournamentPlayer = await prisma.tournamentPlayer.findFirst({
      where: { playerId, tournamentId: tournament.id },
      select: { comodinesUsed: true },
    });

    const comodinesUsed = tournamentPlayer?.comodinesUsed ?? 0;
    const comodinesRemaining = Math.max(0, tournament.maxComodinesPerPlayer - comodinesUsed);

    // Verificar restricciones temporales
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const confirmedMatches = gp.group.matches.filter(m => m.isConfirmed);
    const upcomingMatches = gp.group.matches.filter(
      m => m.acceptedDate && new Date(m.acceptedDate) <= twentyFourHoursFromNow
    );

    // Determinar si puede usar comodín
    let canUse = true;
    let restrictionReason = null;

    if (round.isClosed) {
      canUse = false;
      restrictionReason = "La ronda está cerrada";
    } else if (gp.usedComodin) {
      canUse = false;
      restrictionReason = "Ya has usado comodín en esta ronda";
    } else if (comodinesRemaining <= 0) {
      canUse = false;
      restrictionReason = "Has agotado tus comodines disponibles en este torneo";
    } else if (confirmedMatches.length > 0) {
      canUse = false;
      restrictionReason = "Tienes partidos con resultados confirmados";
    } else if (upcomingMatches.length > 0) {
      canUse = false;
      restrictionReason = "Tienes partidos programados en menos de 24 horas";
    }

    // Determinar si puede revocar
    const canRevoke = !!gp.usedComodin && 
                     !round.isClosed && 
                     confirmedMatches.length === 0 && 
                     upcomingMatches.length === 0;

    // Obtener nombre del sustituto si aplica
    let substitutePlayer = null;
    if (gp.substitutePlayerId) {
      const substitute = await prisma.player.findUnique({
        where: { id: gp.substitutePlayerId },
        select: { name: true },
      });
      substitutePlayer = substitute?.name ?? null;
    }

    return {
      used: !!gp.usedComodin,
      usedAt: gp.comodinAt ? gp.comodinAt.toISOString() : null,
      reason: gp.comodinReason ?? null,
      tournamentId: tournament.id,
      roundId,
      playerId,
      comodinesUsedInTournament: comodinesUsed,
      comodinesRemainingInTournament: comodinesRemaining,
      canUse,
      canRevoke,
      restrictionReason,
      mode: gp.usedComodin ? (gp.substitutePlayerId ? "substitute" : "mean") : null,
      points: gp.points || 0,
      substitutePlayer,
      appliedAt: gp.comodinAt ? gp.comodinAt.toISOString() : null,
      tournamentInfo: {
        maxComodines: tournament.maxComodinesPerPlayer,
        comodinesUsed,
        comodinesRemaining,
        enableMeanComodin: tournament.enableMeanComodin,
        enableSubstituteComodin: tournament.enableSubstituteComodin,
      },
      restrictions: {
        hasConfirmedMatches: confirmedMatches.length > 0,
        hasUpcomingMatches: upcomingMatches.length > 0,
        roundClosed: round.isClosed,
      },
    };
  } catch (error) {
    console.error("Error getting comodin status:", error);
    return null;
  }
}

/**
 * Obtiene estadísticas de comodines para una ronda (uso admin)
 */
export async function getRoundComodinStats(roundId: string): Promise<RoundComodinStats> {
  try {
    const players = await prisma.groupPlayer.findMany({
      where: {
        group: { roundId },
      },
      include: {
        player: {
          select: { name: true },
        },
        group: {
          select: { number: true, roundId: true },
        },
      },
    });

    const playersWithDetails: PlayerComodinStatus[] = await Promise.all(
      players.map(async (gp) => {
        // Verificar si puede revocar (misma lógica que getComodinStatus)
        const round = await prisma.round.findUnique({
          where: { id: roundId },
          select: { isClosed: true },
        });

        const matches = await prisma.match.findMany({
          where: {
            groupId: gp.groupId,
            OR: [
              { team1Player1Id: gp.playerId },
              { team1Player2Id: gp.playerId },
              { team2Player1Id: gp.playerId },
              { team2Player2Id: gp.playerId },
            ],
          },
          select: {
            isConfirmed: true,
            acceptedDate: true,
          },
        });

        const now = new Date();
        const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        const confirmedMatches = matches.filter(m => m.isConfirmed);
        const upcomingMatches = matches.filter(
          m => m.acceptedDate && new Date(m.acceptedDate) <= twentyFourHoursFromNow
        );

        const canRevoke = !!gp.usedComodin && 
                         !round?.isClosed && 
                         confirmedMatches.length === 0 && 
                         upcomingMatches.length === 0;

        let restrictionReason = null;
        if (gp.usedComodin && !canRevoke) {
          if (round?.isClosed) restrictionReason = "Ronda cerrada";
          else if (confirmedMatches.length > 0) restrictionReason = "Partidos confirmados";
          else if (upcomingMatches.length > 0) restrictionReason = "Partidos próximos en <24h";
        }

        // Obtener nombre del sustituto
        let substitutePlayerName = null;
        if (gp.substitutePlayerId) {
          const substitute = await prisma.player.findUnique({
            where: { id: gp.substitutePlayerId },
            select: { name: true },
          });
          substitutePlayerName = substitute?.name ?? null;
        }

        return {
          playerId: gp.playerId,
          playerName: gp.player.name,
          groupNumber: gp.group.number,
          usedComodin: !!gp.usedComodin,
          comodinMode: gp.usedComodin ? (gp.substitutePlayerId ? "substitute" : "mean") : undefined,
          substitutePlayerName,
          points: gp.points || 0,
          comodinReason: gp.comodinReason,
          appliedAt: gp.comodinAt ? gp.comodinAt.toISOString() : null,
          canRevoke,
          restrictionReason,
        };
      })
    );

    const totalPlayers = playersWithDetails.length;
    const withComodin = playersWithDetails.filter(p => p.usedComodin).length;
    const revocables = playersWithDetails.filter(p => p.canRevoke).length;

    return {
      roundId,
      totalPlayers,
      withComodin,
      revocables,
      players: playersWithDetails,
    };
  } catch (error) {
    console.error("Error getting round comodin stats:", error);
    return {
      roundId,
      totalPlayers: 0,
      withComodin: 0,
      revocables: 0,
      players: [],
    };
  }
}