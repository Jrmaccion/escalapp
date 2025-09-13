// hooks/useComodin.ts - VERSIÓN MEJORADA COMPLETA
import { useState, useEffect, useCallback, useMemo } from 'react';
import { comodinApi, ComodinStatus } from '@/lib/api/comodin.client';

export type EligiblePlayer = {
  id: string;
  name: string;
  groupNumber: number;
};

// Estados específicos de loading
type LoadingStates = {
  status: boolean;
  applying: boolean;
  revoking: boolean;
  substitutes: boolean;
};

// Tipo para resultados de operaciones
type OperationResult = {
  success: boolean;
  data?: any;
  error?: string;
};

// Mapeo de errores específicos a mensajes amigables
const getErrorMessage = (error: string): string => {
  const errorMappings: Record<string, string> = {
    'CONCURRENT_MODIFICATION': 'Los datos han cambiado. Refresca la página e intenta de nuevo.',
    'COMODIN_LIMIT_REACHED': 'Has alcanzado el límite de comodines para este torneo.',
    'CONFIRMED_MATCHES_EXIST': 'No puedes usar comodín: ya tienes partidos confirmados.',
    'UPCOMING_MATCHES_EXIST': 'No puedes usar comodín: tienes partidos programados en menos de 24 horas.',
    'SUBSTITUTE_ALREADY_SUBBING': 'Este jugador ya actúa como suplente de otro jugador.',
    'SUBSTITUTE_USED_COMODIN': 'El suplente ya ha usado comodín y no puede actuar como suplente.',
    'SUBSTITUTE_LIMIT_REACHED': 'El suplente ha alcanzado el límite de apariciones.',
    'ROUND_CLOSED': 'No se puede usar comodín en una ronda cerrada.',
    'MEAN_COMODIN_DISABLED': 'El comodín de media está deshabilitado en este torneo.',
    'SUBSTITUTE_COMODIN_DISABLED': 'El comodín de sustituto está deshabilitado en este torneo.',
  };

  // Buscar coincidencias en el mensaje de error
  for (const [key, message] of Object.entries(errorMappings)) {
    if (error.includes(key)) {
      return message;
    }
  }

  return error || 'Error desconocido';
};

export function useComodin(roundId: string) {
  const [status, setStatus] = useState<ComodinStatus | null>(null);
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    status: false,
    applying: false,
    revoking: false,
    substitutes: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Función helper para manejar loading específico
  const withLoading = useCallback(async <T,>(
    operation: keyof LoadingStates,
    fn: () => Promise<T>
  ): Promise<T> => {
    setLoadingStates(prev => ({ ...prev, [operation]: true }));
    try {
      return await fn();
    } catch (err) {
      throw err;
    } finally {
      setLoadingStates(prev => ({ ...prev, [operation]: false }));
    }
  }, []);

  // Cargar estado inicial
  const loadStatus = useCallback(async (): Promise<void> => {
    if (!roundId) return;

    await withLoading('status', async () => {
      try {
        setError(null);
        const data = await comodinApi.getStatus(roundId);
        setStatus(data);
      } catch (err: any) {
        const errorMessage = getErrorMessage(err.message || 'Error al cargar estado del comodín');
        setError(errorMessage);
        setStatus(null);
      }
    });
  }, [roundId, withLoading]);

  // Cargar jugadores elegibles
  const loadEligiblePlayers = useCallback(async (): Promise<void> => {
    if (!roundId) return;

    await withLoading('substitutes', async () => {
      try {
        const data = await comodinApi.eligibleSubstitutes(roundId);
        setEligiblePlayers(data.players || []);
      } catch (err: any) {
        console.warn('Error cargando jugadores elegibles:', err.message);
        setEligiblePlayers([]);
      }
    });
  }, [roundId, withLoading]);

  // Aplicar comodín
  const applyComodin = useCallback(async (
    mode: 'mean' | 'substitute',
    substitutePlayerId?: string
  ): Promise<OperationResult> => {
    if (!roundId) {
      return { success: false, error: 'No se especificó roundId' };
    }

    return await withLoading('applying', async () => {
      try {
        setError(null);
        setMessage(null);

        let result;
        if (mode === 'mean') {
          result = await comodinApi.applyMean(roundId);
          setMessage(`Comodín aplicado: ${result.points?.toFixed(1)} puntos asignados`);
        } else if (mode === 'substitute' && substitutePlayerId) {
          result = await comodinApi.applySubstitute(roundId, substitutePlayerId);
          const substituteName = eligiblePlayers.find(p => p.id === substitutePlayerId)?.name;
          setMessage(`Suplente asignado: ${substituteName} jugará por ti`);
        } else {
          throw new Error('Datos incompletos para aplicar comodín');
        }

        // Recargar estado
        await loadStatus();
        return { success: true, data: result };
      } catch (err: any) {
        const errorMsg = getErrorMessage(err.message || 'Error al aplicar comodín');
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    });
  }, [roundId, eligiblePlayers, loadStatus, withLoading]);

  // Revocar comodín
  const revokeComodin = useCallback(async (): Promise<OperationResult> => {
    if (!roundId) {
      return { success: false, error: 'No se especificó roundId' };
    }

    return await withLoading('revoking', async () => {
      try {
        setError(null);
        setMessage(null);

        const result = await comodinApi.revoke(roundId);
        setMessage(result.message || 'Comodín revocado exitosamente');
        
        // Recargar estado
        await loadStatus();
        return { success: true, data: result };
      } catch (err: any) {
        const errorMsg = getErrorMessage(err.message || 'Error al revocar comodín');
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    });
  }, [roundId, loadStatus, withLoading]);

  // Validar si puede usar un tipo específico de comodín
  const canUseMode = useCallback((mode: 'mean' | 'substitute'): boolean => {
    if (!status?.canUse) return false;
    
    // Si no hay tournamentInfo extendida, asumir que ambos están habilitados (compatibilidad)
    if (!status.tournamentInfo) return true;
    
    // Verificar configuración específica si está disponible
    const tournamentInfo = status.tournamentInfo as any;
    
    if (mode === 'mean') {
      return tournamentInfo.enableMeanComodin !== false;
    }
    
    if (mode === 'substitute') {
      return tournamentInfo.enableSubstituteComodin !== false;
    }
    
    return true;
  }, [status]);

  // Obtener mensaje explicativo para modo deshabilitado
  const getModeDisabledReason = useCallback((mode: 'mean' | 'substitute'): string | null => {
    if (!status?.tournamentInfo) return 'Configuración no disponible';
    
    const tournamentInfo = status.tournamentInfo as any;
    
    if (mode === 'mean' && tournamentInfo.enableMeanComodin === false) {
      return 'El comodín de media está deshabilitado en este torneo';
    }
    
    if (mode === 'substitute' && tournamentInfo.enableSubstituteComodin === false) {
      return 'El comodín de sustituto está deshabilitado en este torneo';
    }
    
    return null;
  }, [status]);

  // Validaciones en tiempo real
  const validation = useMemo(() => {
    const issues: Array<{
      type: 'error' | 'warning' | 'info';
      message: string;
      field?: string;
    }> = [];

    if (!status) {
      return { 
        isValid: false, 
        issues: [{ type: 'error' as const, message: 'No se pudo cargar el estado' }],
        hasErrors: true 
      };
    }

    // Validaciones generales
    if (!status.canUse) {
      issues.push({
        type: 'error',
        message: status.restrictionReason || 'No puedes usar comodín en esta ronda'
      });
    }

    // Validaciones de límites
    if (status.tournamentInfo) {
      const remaining = status.tournamentInfo.comodinesRemaining;
      if (remaining <= 0) {
        issues.push({
          type: 'error',
          message: 'Has alcanzado el límite de comodines para este torneo'
        });
      } else if (remaining === 1) {
        issues.push({
          type: 'warning',
          message: 'Este es tu último comodín disponible'
        });
      }
    }

    const errors = issues.filter(i => i.type === 'error');
    const isValid = errors.length === 0 && status.canUse;

    return { isValid, issues, hasErrors: errors.length > 0 };
  }, [status]);

  // Datos de configuración memoizados
  const comodinesConfig = useMemo(() => {
    if (!status?.tournamentInfo) return null;

    return {
      maxComodines: status.tournamentInfo.maxComodines,
      comodinesUsed: status.tournamentInfo.comodinesUsed,
      comodinesRemaining: status.tournamentInfo.comodinesRemaining,
      // Propiedades extendidas (cuando estén disponibles)
      meanEnabled: (status.tournamentInfo as any).enableMeanComodin !== false,
      substituteEnabled: (status.tournamentInfo as any).enableSubstituteComodin !== false,
    };
  }, [status?.tournamentInfo]);

  // Estado de loading consolidado
  const isLoading = useMemo(() => {
    return Object.values(loadingStates).some(Boolean);
  }, [loadingStates]);

  // Utilidades adicionales
  const hasComodinesRemaining = useMemo(() => {
    return status?.tournamentInfo ? status.tournamentInfo.comodinesRemaining > 0 : false;
  }, [status?.tournamentInfo]);

  // Efectos
  useEffect(() => {
    if (roundId) {
      loadStatus();
    }
  }, [roundId, loadStatus]);

  // Auto-limpiar mensajes después de 6 segundos
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage(null);
        setError(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  // Función para limpiar mensajes manualmente
  const clearMessages = useCallback(() => {
    setError(null);
    setMessage(null);
  }, []);

  // Función de refresh manual
  const refresh = useCallback(async () => {
    await loadStatus();
    if (eligiblePlayers.length > 0) {
      await loadEligiblePlayers();
    }
  }, [loadStatus, loadEligiblePlayers, eligiblePlayers.length]);

  return {
    // Estado principal
    status,
    eligiblePlayers,
    error,
    message,
    
    // Estados de loading específicos
    loadingStates,
    isLoading,
    
    // Funciones principales
    loadStatus,
    loadEligiblePlayers,
    applyComodin,
    revokeComodin,
    
    // Validaciones
    canUseMode,
    getModeDisabledReason,
    validation,
    
    // Utilidades
    clearMessages,
    refresh,
    hasComodinesRemaining,
    comodinesConfig,
    
    // Helpers específicos
    isStatusLoading: loadingStates.status,
    isApplying: loadingStates.applying,
    isRevoking: loadingStates.revoking,
    isLoadingSubstitutes: loadingStates.substitutes,
    
    // Estados derivados
    canUse: status?.canUse || false,
    isUsed: status?.used || false,
    canRevoke: status?.canRevoke || false,
    mode: status?.mode || null,
    points: status?.points || 0,
    substitutePlayer: status?.substitutePlayer || null,
  };
}