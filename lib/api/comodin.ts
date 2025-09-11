// lib/comodin.ts
// Integración de "comodín" (wildcard) a nivel de ronda/grupo.
// Reglas clave (según documentación):
// - 1 comodín por temporada/torneo por jugador.
// - El comodín se aplica en una ronda concreta (se marca en GroupPlayer).
// - No cuenta como “jugada” (no suma racha). El cálculo de puntos/racha debe respetar estos flags.
// - No modificamos partidos aquí; la lógica de cierre de ronda/engine deberá interpretar el comodín.

import { prisma } from "@/lib/prisma";

export type ComodinResult = { success: boolean; message: string };

export type ComodinStatus = {
  used: boolean;
  usedAt: string | null;
  reason: string | null;
  // información útil para UI:
  tournamentId: string;
  roundId: string;
  playerId: string;
  // métricas (estimadas) para front:
  comodinesUsedInTournament: number;
  comodinesRemainingInTournament: number; // 0 ó 1
};

/**
 * Marca el comodín para un jugador en una ronda.
 * Valida que el jugador esté asignado a la ronda y que no haya consumido ya su comodín en el torneo.
 * No altera partidos; se espera que el motor tenga en cuenta "usedComodin" en el cómputo.
 */
export async function useComodin(
  playerId: string,
  roundId: string,
  reason: string
): Promise<ComodinResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1) Localizar el GroupPlayer del jugador en la ronda
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

      // 2) Validar límite: 1 comodín por torneo
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

      // 3) Aplicar flags en GroupPlayer
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
 * Útil para correcciones de admin. No valida “consumo por torneo”
 * porque estamos deshaciendo el uso.
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
 * Devuelve el estado del comodín para un jugador en una ronda,
 * e información de consumo a nivel de torneo (0/1 disponibles).
 */
export async function getComodinStatus(
  playerId: string,
  roundId: string
): Promise<ComodinStatus | null> {
  // Cargamos el vínculo GroupPlayer → Group → Round (para obtener tournamentId)
  const gp = await prisma.groupPlayer.findFirst({
    where: {
      playerId,
      group: { roundId },
    },
    include: {
      group: {
        include: { round: true },
      },
    },
  });

  if (!gp) return null;

  const tournamentId = gp.group.round.tournamentId;

  // cuántos comodines ha usado el jugador en el torneo (esperado 0 o 1)
  const usedCountInTournament = await prisma.groupPlayer.count({
    where: {
      playerId,
      usedComodin: true,
      group: { round: { tournamentId } },
    },
  });

  return {
    used: !!gp.usedComodin,
    usedAt: gp.comodinAt ? gp.comodinAt.toISOString() : null,
    reason: gp.comodinReason ?? null,
    tournamentId,
    roundId,
    playerId,
    comodinesUsedInTournament: usedCountInTournament,
    comodinesRemainingInTournament: usedCountInTournament > 0 ? 0 : 1,
  };
}
// ==============================
// API wrapper para componentes React  
// ==============================

export const comodinApi = {
  useComodin: async (roundId: string, reason?: string) => {
    const response = await fetch('/api/comodin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId, reason }),
    });
    return response.json();
  },

  revokeComodin: async (roundId: string) => {
    const response = await fetch('/api/comodin/revoke', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId }),
    });
    return response.json();
  },

  getStatus: async (roundId: string) => {
    const response = await fetch(`/api/comodin/status?roundId=${roundId}`);
    return response.json();
  },

  getEligibleSubstitutes: async (roundId: string) => {
    const response = await fetch(`/api/comodin/eligible-substitutes?roundId=${roundId}`);
    return response.json();
  },

  getRoundStats: async (roundId: string) => {
    const response = await fetch(`/api/comodin/round-stats?roundId=${roundId}`);
    return response.json();
  }
};

export default comodinApi;