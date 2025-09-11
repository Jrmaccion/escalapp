// lib/api/comodin.client.ts - Solo lógica de fetch para componentes cliente
// NO importa Prisma - safe para bundle del cliente

// ==============================
// TIPOS (copiados desde el server)
// ==============================

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
// API CLIENT (solo fetch calls)
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
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al aplicar comodín de media');
    }
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
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al aplicar comodín de sustituto');
    }
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
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al revocar comodín');
    }
    return response.json();
  },

  /**
   * Revocar comodín específico (admin)
   */
  adminRevoke: async (roundId: string, playerId: string): Promise<any> => {
    const response = await fetch(`/api/comodin/revoke?roundId=${roundId}&playerId=${playerId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al revocar comodín por admin');
    }
    return response.json();
  },

  /**
   * Obtener estado del comodín
   */
  getStatus: async (roundId: string): Promise<ComodinStatus | null> => {
    const response = await fetch(`/api/comodin/status?roundId=${roundId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al obtener estado');
    }
    return response.json();
  },

  /**
   * Obtener estadísticas de comodines para una ronda (admin)
   */
  getRoundStats: async (roundId: string): Promise<RoundComodinStats> => {
    const response = await fetch(`/api/comodin/round-stats?roundId=${roundId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al obtener estadísticas');
    }
    return response.json();
  },

  /**
   * Obtener sustitutos elegibles
   */
  eligibleSubstitutes: async (roundId: string): Promise<{ players: Array<{ id: string; name: string; groupNumber: number }> }> => {
    const response = await fetch(`/api/comodin/eligible-substitutes?roundId=${roundId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al obtener sustitutos');
    }
    return response.json();
  },

  // Métodos legacy para compatibilidad
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