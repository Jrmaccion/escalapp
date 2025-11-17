// hooks/useGroupDataEnhanced.ts - Hook mejorado para datos de grupos
import { useApiState } from "./useApiState";

export type GroupDataOptions = {
  groupId?: string;
  tournamentId?: string;
  includeMatches?: boolean;
  includeMovements?: boolean;
  autoRefresh?: boolean;
};

export function useGroupDataEnhanced(options: GroupDataOptions = {}) {
  const {
    groupId,
    tournamentId,
    includeMatches = false,
    includeMovements = false,
    autoRefresh = false,
  } = options;

  return useApiState(
    async () => {
      // Si hay groupId específico, usar endpoint de grupo
      if (groupId) {
        const params = new URLSearchParams();
        if (includeMatches) params.set("includeMatches", "true");
        if (includeMovements) params.set("includeMovements", "true");

        const response = await fetch(`/api/groups/${groupId}/stats?${params.toString()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Error al cargar grupo: ${response.statusText}`);
        }

        return response.json();
      }

      // Si no hay groupId, usar endpoint de "mi grupo"
      const params = new URLSearchParams();
      if (tournamentId) params.set("tournamentId", tournamentId);

      const response = await fetch(`/api/player/group?${params.toString()}`, {
        cache: "no-store",
      });

      if (response.status === 404) {
        return null; // Usuario no tiene grupo asignado
      }

      if (!response.ok) {
        throw new Error(`Error al cargar grupo: ${response.statusText}`);
      }

      return response.json();
    },
    {
      loadingMessage: "Cargando información del grupo...",
      emptyMessage: "No tienes un grupo asignado en esta ronda",
      autoRefresh,
      autoExecute: true,
    }
  );
}
