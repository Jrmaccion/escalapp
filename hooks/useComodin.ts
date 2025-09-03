// hooks/useComodin.ts - ACTUALIZADO PARA USAR LA API EXISTENTE
import { useState, useEffect, useCallback } from 'react';
import { comodinApi, ComodinStatus } from '@/lib/api/comodin';

export type EligiblePlayer = {
  id: string;
  name: string;
  groupNumber: number;
};

export function useComodin(roundId: string) {
  const [status, setStatus] = useState<ComodinStatus | null>(null);
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Cargar estado inicial
  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await comodinApi.getStatus(roundId);
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar estado del comodín');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [roundId]);

  // Cargar jugadores elegibles
  const loadEligiblePlayers = useCallback(async () => {
    try {
      const data = await comodinApi.eligibleSubstitutes(roundId);
      setEligiblePlayers(data.players || []);
    } catch (err: any) {
      console.warn('Error cargando jugadores elegibles:', err.message);
      setEligiblePlayers([]);
    }
  }, [roundId]);

  // Aplicar comodín
  const applyComodin = useCallback(async (
    mode: 'mean' | 'substitute',
    substitutePlayerId?: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      let result;
      if (mode === 'mean') {
        result = await comodinApi.applyMean(roundId);
      } else if (mode === 'substitute' && substitutePlayerId) {
        result = await comodinApi.applySubstitute(roundId, substitutePlayerId);
      } else {
        throw new Error('Datos incompletos para aplicar comodín');
      }

      setMessage(result.message || 'Comodín aplicado exitosamente');
      // Recargar estado
      await loadStatus();
      return { success: true, data: result };
    } catch (err: any) {
      const errorMsg = err.message || 'Error al aplicar comodín';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [roundId, loadStatus]);

  // Revocar comodín
  const revokeComodin = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const result = await comodinApi.revoke(roundId);
      setMessage(result.message || 'Comodín revocado exitosamente');
      // Recargar estado
      await loadStatus();
      return { success: true, data: result };
    } catch (err: any) {
      const errorMsg = err.message || 'Error al revocar comodín';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [roundId, loadStatus]);

  // Validar si puede usar un tipo específico de comodín
  const canUseMode = useCallback((mode: 'mean' | 'substitute') => {
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
  const getModeDisabledReason = useCallback((mode: 'mean' | 'substitute') => {
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

  // Efectos
  useEffect(() => {
    if (roundId) {
      loadStatus();
    }
  }, [roundId, loadStatus]);

  // Auto-limpiar mensajes después de 5 segundos
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  return {
    status,
    eligiblePlayers,
    loading,
    error,
    message,
    loadStatus,
    loadEligiblePlayers,
    applyComodin,
    revokeComodin,
    canUseMode,
    getModeDisabledReason,
    clearMessages: () => {
      setError(null);
      setMessage(null);
    },
    // Utilidades adicionales
    hasComodinesRemaining: status?.tournamentInfo ? 
      status.tournamentInfo.comodinesRemaining > 0 : false,
    comodinesConfig: status?.tournamentInfo ? {
      maxComodines: status.tournamentInfo.maxComodines,
      comodinesUsed: status.tournamentInfo.comodinesUsed,
      comodinesRemaining: status.tournamentInfo.comodinesRemaining,
      // Propiedades extendidas (cuando estén disponibles)
      meanEnabled: (status.tournamentInfo as any).enableMeanComodin !== false,
      substituteEnabled: (status.tournamentInfo as any).enableSubstituteComodin !== false,
    } : null,
  };
}