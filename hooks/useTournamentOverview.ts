// hooks/useTournamentOverview.ts - Hook especializado para vista de overview del torneo
import { useApiState } from "./useApiState";

export type TournamentOverviewOptions = {
  tournamentId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
};

export function useTournamentOverview(options: TournamentOverviewOptions = {}) {
  const { tournamentId, autoRefresh = false, refreshInterval = 30000 } = options;

  return useApiState(
    async () => {
      if (!tournamentId) {
        throw new Error("tournamentId es requerido");
      }

      const response = await fetch(`/api/tournaments/${tournamentId}/overview`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
    {
      loadingMessage: "Cargando vista del torneo...",
      emptyMessage: "No hay datos del torneo disponibles",
      autoRefresh,
      refreshInterval,
      autoExecute: !!tournamentId, // Solo ejecutar si hay tournamentId
    }
  );
}
