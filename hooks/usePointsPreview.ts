// hooks/usePointsPreview.ts - CORREGIDO
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GroupPointsPreview, PointsPreview } from '@/lib/points-calculator';

type UsePointsPreviewOptions = {
  enabled?: boolean;
  refreshInterval?: number; // ms, default 30000 (30s)
  autoRefreshOnSetConfirmation?: boolean;
  silentRefresh?: boolean; // Si true, no muestra loading en refreshes automáticos
};

type UsePointsPreviewReturn = {
  preview: GroupPointsPreview | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null; // ✅ CORREGIDO: string | null en lugar de Date | null
  hasChanges: boolean;
  refresh: () => Promise<void>;
  refreshSilent: () => Promise<void>;
  getPlayerPreview: (playerId: string) => PointsPreview | null;
  clearChanges: () => void;
  isEnabled: boolean;
};

export function usePointsPreview(
  groupId: string | undefined,
  options: UsePointsPreviewOptions = {}
): UsePointsPreviewReturn {
  const {
    enabled = true,
    refreshInterval = 30000,
    autoRefreshOnSetConfirmation = true,
    silentRefresh = true
  } = options;

  const [preview, setPreview] = useState<GroupPointsPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null); // ✅ CORREGIDO: string | null
  const [hasChanges, setHasChanges] = useState(false);
  
  const isMountedRef = useRef(true);
  const lastDataRef = useRef<string>("");
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPreview = useCallback(async (silent = false) => {
    if (!groupId || !enabled || !isMountedRef.current) return;

    console.log(`🎯 [usePointsPreview] Fetching para grupo ${groupId}`, { silent, enabled });

    if (!silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const response = await fetch(`/api/groups/${groupId}/points-preview`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!isMountedRef.current) return;

      if (result.success && result.data) {
        const newDataStr = JSON.stringify(result.data);
        const hasDataChanges = Boolean(
          silent && 
          lastDataRef.current && 
          lastDataRef.current !== newDataStr &&
          result.data.completionRate > 0
        );
        
        setPreview(result.data);
        setLastUpdated(new Date().toISOString()); // ✅ CORREGIDO: Mantener como string ISO
        setError(null);
        setHasChanges(hasDataChanges);
        lastDataRef.current = newDataStr;

        console.log(`✅ [usePointsPreview] Preview actualizado:`, {
          completionRate: result.data.completionRate,
          playersCount: result.data.players.length,
          hasChanges: hasDataChanges,
          completedSets: result.data.completedSets,
          totalSets: result.data.totalSets
        });

        // Auto-marcar cambios como vistos después de 5 segundos
        if (hasDataChanges) {
          setTimeout(() => {
            if (isMountedRef.current) {
              setHasChanges(false);
            }
          }, 5000);
        }
      } else {
        throw new Error(result.error || 'Error desconocido al obtener preview');
      }

    } catch (err: any) {
      console.error('❌ [usePointsPreview] Error:', err);

      if (!isMountedRef.current) return;

      setError(err.message || 'Error al cargar preview de puntos');
      if (!silent) {
        setPreview(null);
        lastDataRef.current = "";
      }
    } finally {
      if (!silent && isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [groupId, enabled]);

  const refresh = useCallback(() => {
    return fetchPreview(false);
  }, [fetchPreview]);

  const refreshSilent = useCallback(() => {
    return fetchPreview(true);
  }, [fetchPreview]);

  const clearChanges = useCallback(() => {
    setHasChanges(false);
  }, []);

  // Función helper para obtener preview de un jugador específico
  const getPlayerPreview = useCallback((playerId: string): PointsPreview | null => {
    if (!preview) return null;
    return preview.players.find(p => p.playerId === playerId) || null;
  }, [preview]);

  // Efecto de carga inicial
  useEffect(() => {
    if (enabled && groupId) {
      console.log(`🚀 [usePointsPreview] Carga inicial para grupo ${groupId}`);
      fetchPreview(false);
    }
    
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchPreview, enabled, groupId]);

  // Auto-refresh periódico con backoff inteligente
  useEffect(() => {
    if (!enabled || !groupId || refreshInterval <= 0 || !preview) return;

    // Si está completo al 100%, reducir frecuencia de refresh
    const actualInterval = preview.isComplete 
      ? refreshInterval * 2  // Refrescar menos frecuentemente si está completo
      : refreshInterval;

    console.log(`⏰ [usePointsPreview] Configurando auto-refresh cada ${actualInterval}ms`);

    const interval = setInterval(() => {
      if (isMountedRef.current && document.visibilityState === 'visible') {
        console.log('🔄 [usePointsPreview] Auto-refresh ejecutándose');
        fetchPreview(silentRefresh);
      }
    }, actualInterval);

    return () => {
      clearInterval(interval);
    };
  }, [fetchPreview, enabled, groupId, refreshInterval, silentRefresh, preview?.isComplete]);

  // Refresh cuando la página vuelve a ser visible
  useEffect(() => {
    if (!enabled || !groupId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && preview && isMountedRef.current) {
        console.log('👁️ [usePointsPreview] Página visible, refrescando...');
        // Pequeño delay para evitar múltiples calls simultáneos
        refreshTimeoutRef.current = setTimeout(() => {
          fetchPreview(true);
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchPreview, enabled, groupId, preview]);

  // Limpieza en unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  return {
    preview,
    isLoading,
    error,
    lastUpdated,
    hasChanges,
    refresh,
    refreshSilent,
    getPlayerPreview,
    clearChanges,
    isEnabled: enabled && Boolean(groupId)
  };
}

/**
 * Hook simplificado para obtener solo el preview de un jugador
 */
export function usePlayerPointsPreview(
  playerId: string | undefined,
  groupId: string | undefined,
  options: UsePointsPreviewOptions = {}
): {
  playerPreview: PointsPreview | null;
  isLoading: boolean;
  error: string | null;
  hasChanges: boolean;
  refresh: () => Promise<void>;
  clearChanges: () => void;
} {
  const { 
    preview, 
    isLoading, 
    error, 
    hasChanges, 
    refresh, 
    getPlayerPreview,
    clearChanges 
  } = usePointsPreview(groupId, options);
  
  const playerPreview = playerId ? getPlayerPreview(playerId) : null;
  
  return {
    playerPreview,
    isLoading,
    error,
    hasChanges,
    refresh,
    clearChanges
  };
}

/**
 * Hook para estadísticas rápidas sin el preview completo
 */
export function useGroupStats(
  groupId: string | undefined,
  refreshInterval = 15000
): {
  stats: {
    completionRate: number;
    completedSets: number;
    totalSets: number;
    hasRecentChanges: boolean;
  } | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isMountedRef = useRef(true);

  const fetchStats = useCallback(async () => {
    if (!groupId || !isMountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/groups/${groupId}/stats`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      const result = await response.json();
      
      if (isMountedRef.current && result.success) {
        setStats(result.data);
        setError(null);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || 'Error al cargar estadísticas');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [groupId]);

  useEffect(() => {
    if (groupId) {
      fetchStats();
    }
  }, [fetchStats, groupId]);

  useEffect(() => {
    if (!groupId || refreshInterval <= 0) return;

    const interval = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchStats, groupId, refreshInterval]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    stats,
    isLoading,
    error,
    refresh: fetchStats
  };
}