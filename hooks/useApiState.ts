// hooks/useApiState.ts - FIX: evitar bucles por dependencia de execute/fetchFn
import { useState, useCallback, useEffect, useRef } from "react";

export type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  hasUpdates: boolean;
};

export type UseApiStateOptions = {
  initialData?: any;
  loadingMessage?: string;
  emptyMessage?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  autoExecute?: boolean; // Controla la ejecución automática al montar
};

export function useApiState<T>(
  fetchFn: () => Promise<T>,
  options: UseApiStateOptions = {}
) {
  const {
    initialData = null,
    loadingMessage = "Cargando...",
    emptyMessage = "No hay datos disponibles",
    autoRefresh = false,
    refreshInterval = 60_000,
    autoExecute = true,
  } = options;

  // Mantener fetchFn estable a través de renders
  const fetchRef = useRef(fetchFn);
  useEffect(() => {
    fetchRef.current = fetchFn;
  }, [fetchFn]);

  const [state, setState] = useState<ApiState<T>>({
    data: initialData,
    loading: false,
    error: null,
    lastUpdated: null,
    hasUpdates: false,
  });

  // execute estable: no depende de fetchFn (lo lee desde ref)
  const execute = useCallback(async (silent = false) => {
    if (!silent) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }
    try {
      const result = await fetchRef.current();
      setState((prev) => ({
        data: result,
        loading: false,
        error: null,
        lastUpdated: new Date(),
        // si refrescamos en segundo plano y ya había datos, marcamos "hay novedades"
        hasUpdates: silent && prev.data != null,
      }));
      return result;
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error?.message || "Error desconocido",
        hasUpdates: false,
      }));
      throw error;
    }
  }, []);

  // Ejecutar automáticamente SOLO una vez por montaje (evitar StrictMode double-invoke)
  const didAutoRunRef = useRef(false);
  useEffect(() => {
    if (autoExecute && !didAutoRunRef.current) {
      didAutoRunRef.current = true;
      void execute(false);
    }
  }, [autoExecute, execute]);

  // Auto-refresh opcional (silencioso)
  useEffect(() => {
    if (!autoRefresh || !refreshInterval) return;
    const id = setInterval(() => void execute(true), refreshInterval);
    return () => clearInterval(id);
  }, [autoRefresh, refreshInterval, execute]);

  const retry = useCallback(() => {
    void execute(false);
  }, [execute]);

  const refresh = useCallback(() => {
    void execute(true);
  }, [execute]);

  const clearUpdates = useCallback(() => {
    setState((prev) => ({ ...prev, hasUpdates: false }));
  }, []);

  return {
    ...state,
    execute,
    retry,
    refresh,
    clearUpdates,
    // Helpers
    isLoading: state.loading,
    hasError: !!state.error,
    isEmpty:
      !state.loading &&
      !state.error &&
      (state.data == null ||
        (Array.isArray(state.data) && state.data.length === 0)),
    isReady: !state.loading && !state.error && state.data != null,
    // Mensajes para componentes
    loadingMessage,
    emptyMessage,
  };
}

// Hook especializado para datos de grupo
export function useGroupData() {
  return useApiState(
    async () => {
      const response = await fetch("/api/player/group", { cache: "no-store" });
      if (!response.ok) throw new Error("Error al cargar datos del grupo");
      return response.json();
    },
    {
      loadingMessage: "Cargando información del grupo...",
      emptyMessage: "No tienes un grupo asignado en esta ronda",
      autoRefresh: false,
      autoExecute: true,
    }
  );
}

// Hook especializado para resultados de admin
export function useAdminResults(filters?: Record<string, any>) {
  return useApiState(
    async () => {
      const params = new URLSearchParams(filters || {});
      const response = await fetch(`/api/admin/results?${params.toString()}`);
      if (!response.ok) throw new Error("Error al cargar resultados");
      return response.json();
    },
    {
      loadingMessage: "Cargando resultados...",
      emptyMessage: "No se encontraron resultados",
      autoExecute: false, // en admin, ejecuta manualmente
    }
  );
}

// Hook especializado para dashboard
export function useDashboardData() {
  return useApiState(
    async () => {
      const response = await fetch("/api/player/dashboard");
      if (!response.ok) throw new Error("Error al cargar dashboard");
      return response.json();
    },
    {
      loadingMessage: "Cargando tu información...",
      emptyMessage: "No hay datos disponibles",
      autoExecute: true,
    }
  );
}
