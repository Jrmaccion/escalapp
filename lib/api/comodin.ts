// lib/api/comodin.ts - CORRECCIÓN: Usar el endpoint correcto
// SDK cliente tipado para operaciones de Comodín

export type ComodinMode = "mean" | "substitute";

export type ComodinStatus = {
  success: boolean;
  used: boolean;
  canUse: boolean;
  mode?: ComodinMode;
  substitutePlayer?: string | null;
  points?: number | null;
  canRevoke?: boolean;
  reason?: string;
  appliedAt?: string | Date | null;
  restrictionReason?: string;
  restrictions?: {
    hasConfirmedMatches: boolean;
    hasUpcomingMatches: boolean;
    roundClosed: boolean;
    nextMatchDate: string | null;
  };
  tournamentInfo?: {
    comodinesUsed: number;
    maxComodines: number;
    comodinesRemaining: number;
    // NUEVOS: configuración del torneo
    enableMeanComodin?: boolean;
    enableSubstituteComodin?: boolean;
  };
  groupInfo?: {
    groupNumber: number;
    points: number;
  };
};

export type PlayerComodinStatus = {
  playerId: string;
  playerName: string;
  groupNumber: number;
  usedComodin: boolean;
  comodinMode?: "mean" | "substitute";
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

async function handle<T>(res: Response): Promise<T> {
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = data?.code ?? "HTTP_ERROR";
    throw err;
  }
  return data as T;
}

export const comodinApi = {
  async getStatus(roundId: string): Promise<ComodinStatus> {
    // 🔥 CAMBIO CRÍTICO: Usar /api/comodin en lugar de /api/comodin/status
    const res = await fetch(`/api/comodin?roundId=${encodeURIComponent(roundId)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return handle<ComodinStatus>(res);
  },

  async applyMean(roundId: string) {
    const res = await fetch(`/api/comodin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId, mode: "mean" }),
    });
    return handle<any>(res);
  },

  async applySubstitute(roundId: string, substitutePlayerId: string) {
    const res = await fetch(`/api/comodin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId, mode: "substitute", substitutePlayerId }),
    });
    return handle<any>(res);
  },

  async revoke(roundId: string) {
    const res = await fetch(`/api/comodin/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId }),
    });
    return handle<any>(res);
  },

  async adminRevoke(roundId: string, playerId: string) {
    const res = await fetch(
      `/api/comodin/revoke?roundId=${encodeURIComponent(roundId)}&playerId=${encodeURIComponent(playerId)}`,
      { method: "DELETE", headers: { Accept: "application/json" } }
    );
    return handle<any>(res);
  },

  async eligibleSubstitutes(roundId: string) {
    const res = await fetch(`/api/comodin/eligible-substitutes?roundId=${encodeURIComponent(roundId)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return handle<{ players: Array<{ id: string; name: string; groupNumber: number }> }>(res);
  },

  async getRoundStats(roundId: string): Promise<RoundComodinStats> {
    const res = await fetch(`/api/comodin/round-stats?roundId=${encodeURIComponent(roundId)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return handle<RoundComodinStats>(res);
  },
};