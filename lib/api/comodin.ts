// lib/comodin.ts
// Integración de "comodín" (wildcard) a nivel de ronda/grupo.
// Reglas clave (según documentación):
// - 1 comodín por temporada/torneo por jugador.
// - El comodín se aplica en una ronda concreta (se marca en GroupPlayer).
// - No cuenta como "jugada" (no suma racha). El cálculo de puntos/racha debe respetar estos flags.
// - No modificamos partidos aquí; la lógica de cierre de ronda/engine deberá interpretar el comodín.

import { prisma } from "@/lib/prisma";

// ==============================
// TIPOS PRINCIPALES
// ==============================

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

// Tipos adicionales para componentes
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
 * Útil para correcciones de admin. No valida "consumo por torneo"
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
// API WRAPPER COMPLETO PARA COMPONENTES REACT
// ==============================

export const comodinApi = {
  /**
   * Usar comodín de media
   */
  applyMean: async (roundId: string): Promise<any> => {
    const response = await fetch('/api/comodin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId, mode: 'mean' }),
    });
    if (!response.ok) throw new Error('Error al aplicar comodín de media');
    return response.json();
  },

  /**
   * Usar comodín de sustituto
   */
  applySubstitute: async (roundId: string, substitutePlayerId: string): Promise<any> => {
    const response = await fetch('/api/comodin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        roundId, 
        mode: 'substitute', 
        substitutePlayerId 
      }),
    });
    if (!response.ok) throw new Error('Error al aplicar comodín de sustituto');
    return response.json();
  },

  /**
   * Revocar comodín (jugador)
   */
  revoke: async (roundId: string): Promise<any> => {
    const response = await fetch('/api/comodin/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId }),
    });
    if (!response.ok) throw new Error('Error al revocar comodín');
    return response.json();
  },

  /**
   * Revocar comodín específico (admin)
   */
  adminRevoke: async (roundId: string, playerId: string): Promise<any> => {
    const response = await fetch(`/api/comodin/revoke?roundId=${roundId}&playerId=${playerId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error al revocar comodín por admin');
    return response.json();
  },

  /**
   * Obtener estado del comodín
   */
  getStatus: async (roundId: string): Promise<ComodinStatus | null> => {
    const response = await fetch(`/api/comodin/status?roundId=${roundId}`);
    if (!response.ok) throw new Error('Error al obtener estado');
    return response.json();
  },

  /**
   * Obtener estadísticas de comodines para una ronda (admin)
   */
  getRoundStats: async (roundId: string): Promise<RoundComodinStats> => {
    const response = await fetch(`/api/comodin/round-stats?roundId=${roundId}`);
    if (!response.ok) throw new Error('Error al obtener estadísticas');
    return response.json();
  },

  /**
   * Obtener sustitutos elegibles
   */
  eligibleSubstitutes: async (roundId: string): Promise<{ players: Array<{ id: string; name: string; groupNumber: number }> }> => {
    const response = await fetch(`/api/comodin/eligible-substitutes?roundId=${roundId}`);
    if (!response.ok) throw new Error('Error al obtener sustitutos');
    return response.json();
  },

  // Métodos legacy para compatibilidad con otros archivos
  useComodin: async (roundId: string, reason?: string) => {
    return comodinApi.applyMean(roundId);
  },

  revokeComodin: async (roundId: string) => {
    return comodinApi.revoke(roundId);
  },

  getEligibleSubstitutes: async (roundId: string) => {
    return comodinApi.eligibleSubstitutes(roundId);
  }
};

export default comodinApi;