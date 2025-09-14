// hooks/useComodin.ts - VERSIÓN SIMPLIFICADA SIN DEPENDENCIAS CIRCULARES
import { useState, useEffect, useCallback, useMemo } from 'react';

export type EligiblePlayer = {
  id: string;
  name: string;
  groupNumber: number;
};

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
  tournamentInfo?: {
    maxComodines: number;
    comodinesUsed: number;
    comodinesRemaining: number;
    enableMeanComodin?: boolean;
    enableSubstituteComodin?: boolean;
  };
};

type UseComodinReturn = {
  // Estado
  status: ComodinStatus | null;
  eligiblePlayers: EligiblePlayer[];
  error: string | null;
  message: string | null;
  
  // Estados de loading
  isLoading: boolean;
  isApplying: boolean;
  isRevoking: boolean;
  isLoadingSubstitutes: boolean;
  
  // Funciones
  loadStatus: () => Promise<void>;
  loadEligiblePlayers: () => Promise<void>;
  applyComodin: (mode: 'mean' | 'substitute', substituteId?: string) => Promise<{ success: boolean; error?: string }>;
  revokeComodin: () => Promise<{ success: boolean; error?: string }>;
  clearMessages: () => void;
  
  // Helpers
  canUse: boolean;
  isUsed: boolean;
  canRevoke: boolean;
  mode: string | null;
  points: number;
  substitutePlayer: string | null;
  comodinesConfig: any;
  
  // Validaciones
  canUseMode: (mode: 'mean' | 'substitute') => boolean;
  getModeDisabledReason: (mode: 'mean' | 'substitute') => string | null;
  validation: {
    isValid: boolean;
    issues: Array<{ type: 'error' | 'warning' | 'info'; message: string }>;
    hasErrors: boolean;
  };
};

const ERROR_MAPPINGS: Record<string, string> = {
  'CONCURRENT_MODIFICATION': 'Los datos han cambiado. Refresca la página e intenta de nuevo.',
  'COMODIN_LIMIT_REACHED': 'Has alcanzado el límite de comodines para este torneo.',
  'CONFIRMED_MATCHES_EXIST': 'No puedes usar comodín: ya tienes partidos confirmados.',
  'UPCOMING_MATCHES_EXIST': 'No puedes usar comodín: tienes partidos programados en menos de 24 horas.',
  'ROUND_CLOSED': 'No se puede usar comodín en una ronda cerrada.',
  'MEAN_COMODIN_DISABLED': 'El comodín de media está deshabilitado en este torneo.',
  'SUBSTITUTE_COMODIN_DISABLED': 'El comodín de sustituto está deshabilitado en este torneo.',
};

const getErrorMessage = (error: string): string => {
  for (const [key, message] of Object.entries(ERROR_MAPPINGS)) {
    if (error.includes(key)) return message;
  }
  return error || 'Error desconocido';
};

// API calls simplificadas
const comodinApi = {
  getStatus: async (roundId: string): Promise<ComodinStatus> => {
    const response = await fetch(`/api/comodin/status?roundId=${roundId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al obtener estado');
    }
    return response.json();
  },

  applyMean: async (roundId: string) => {
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

  applySubstitute: async (roundId: string, substitutePlayerId: string) => {
    const response = await fetch('/api/comodin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId, mode: 'substitute', substitutePlayerId }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al aplicar comodín de sustituto');
    }
    return response.json();
  },

  revoke: async (roundId: string) => {
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

  eligibleSubstitutes: async (roundId: string) => {
    const response = await fetch(`/api/comodin/eligible-substitutes?roundId=${roundId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al obtener sustitutos');
    }
    return response.json();
  },
};

export function useComodin(roundId: string): UseComodinReturn {
  // Estados básicos
  const [status, setStatus] = useState<ComodinStatus | null>(null);
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  // Estados de loading
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isLoadingSubstitutes, setIsLoadingSubstitutes] = useState(false);

  // Función para cargar estado
  const loadStatus = useCallback(async () => {
    if (!roundId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🎲 Cargando estado comodín para ronda: ${roundId}`);
      const data = await comodinApi.getStatus(roundId);
      setStatus(data);
      console.log(`✅ Estado comodín cargado:`, data);
    } catch (err: any) {
      const errorMessage = getErrorMessage(err.message);
      console.error(`❌ Error cargando estado comodín:`, err);
      setError(errorMessage);
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, [roundId]);

  // Función para cargar jugadores elegibles
  const loadEligiblePlayers = useCallback(async () => {
    if (!roundId) return;
    
    setIsLoadingSubstitutes(true);
    
    try {
      console.log(`👥 Cargando jugadores elegibles para ronda: ${roundId}`);
      const data = await comodinApi.eligibleSubstitutes(roundId);
      setEligiblePlayers(data.players || []);
      console.log(`✅ Jugadores elegibles cargados: ${data.players?.length || 0}`);
    } catch (err: any) {
      console.warn(`⚠️ Error cargando jugadores elegibles:`, err);
      setEligiblePlayers([]);
    } finally {
      setIsLoadingSubstitutes(false);
    }
  }, [roundId]);

  // Función para aplicar comodín
  const applyComodin = useCallback(async (
    mode: 'mean' | 'substitute',
    substituteId?: string
  ) => {
    if (!roundId) {
      return { success: false, error: 'No se especificó roundId' };
    }

    setIsApplying(true);
    setError(null);
    setMessage(null);

    try {
      console.log(`🎯 Aplicando comodín ${mode} para ronda: ${roundId}`);
      
      let result;
      if (mode === 'mean') {
        result = await comodinApi.applyMean(roundId);
        setMessage(`Comodín aplicado: ${result.points?.toFixed(1)} puntos asignados`);
      } else if (mode === 'substitute' && substituteId) {
        result = await comodinApi.applySubstitute(roundId, substituteId);
        const substituteName = eligiblePlayers.find(p => p.id === substituteId)?.name;
        setMessage(`Suplente asignado: ${substituteName} jugará por ti`);
      } else {
        throw new Error('Datos incompletos para aplicar comodín');
      }

      console.log(`✅ Comodín aplicado exitosamente:`, result);
      
      // Recargar estado después de 500ms
      setTimeout(() => loadStatus(), 500);
      
      return { success: true };
    } catch (err: any) {
      const errorMsg = getErrorMessage(err.message);
      console.error(`❌ Error aplicando comodín:`, err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsApplying(false);
    }
  }, [roundId, eligiblePlayers, loadStatus]);

  // Función para revocar comodín
  const revokeComodin = useCallback(async () => {
    if (!roundId) {
      return { success: false, error: 'No se especificó roundId' };
    }

    setIsRevoking(true);
    setError(null);
    setMessage(null);

    try {
      console.log(`🔄 Revocando comodín para ronda: ${roundId}`);
      const result = await comodinApi.revoke(roundId);
      setMessage(result.message || 'Comodín revocado exitosamente');
      console.log(`✅ Comodín revocado exitosamente`);
      
      // Recargar estado después de 500ms
      setTimeout(() => loadStatus(), 500);
      
      return { success: true };
    } catch (err: any) {
      const errorMsg = getErrorMessage(err.message);
      console.error(`❌ Error revocando comodín:`, err);
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsRevoking(false);
    }
  }, [roundId, loadStatus]);

  // Limpiar mensajes
  const clearMessages = useCallback(() => {
    setError(null);
    setMessage(null);
  }, []);

  // Validar si puede usar un modo específico
  const canUseMode = useCallback((mode: 'mean' | 'substitute'): boolean => {
    if (!status?.canUse) return false;
    
    const tournamentInfo = status.tournamentInfo;
    if (!tournamentInfo) return true;
    
    if (mode === 'mean') {
      return tournamentInfo.enableMeanComodin !== false;
    }
    
    if (mode === 'substitute') {
      return tournamentInfo.enableSubstituteComodin !== false;
    }
    
    return true;
  }, [status]);

  // Obtener razón de modo deshabilitado
  const getModeDisabledReason = useCallback((mode: 'mean' | 'substitute'): string | null => {
    if (!status?.tournamentInfo) return 'Configuración no disponible';
    
    const tournamentInfo = status.tournamentInfo;
    
    if (mode === 'mean' && tournamentInfo.enableMeanComodin === false) {
      return 'El comodín de media está deshabilitado en este torneo';
    }
    
    if (mode === 'substitute' && tournamentInfo.enableSubstituteComodin === false) {
      return 'El comodín de sustituto está deshabilitado en este torneo';
    }
    
    return null;
  }, [status]);

  // Cálculo de validaciones
  const validation = useMemo(() => {
    const issues: Array<{ type: 'error' | 'warning' | 'info'; message: string }> = [];

    if (!status) {
      return { 
        isValid: false, 
        issues: [{ type: 'error' as const, message: 'No se pudo cargar el estado' }],
        hasErrors: true 
      };
    }

    if (!status.canUse) {
      issues.push({
        type: 'error',
        message: status.restrictionReason || 'No puedes usar comodín en esta ronda'
      });
    }

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
    return { 
      isValid: errors.length === 0 && status.canUse, 
      issues, 
      hasErrors: errors.length > 0 
    };
  }, [status]);

  // Estados derivados
  const canUse = status?.canUse || false;
  const isUsed = status?.used || false;
  const canRevoke = status?.canRevoke || false;
  const mode = status?.mode || null;
  const points = status?.points || 0;
  const substitutePlayer = status?.substitutePlayer || null;

  const comodinesConfig = useMemo(() => {
    if (!status?.tournamentInfo) return null;
    return {
      maxComodines: status.tournamentInfo.maxComodines,
      comodinesUsed: status.tournamentInfo.comodinesUsed,
      comodinesRemaining: status.tournamentInfo.comodinesRemaining,
      meanEnabled: status.tournamentInfo.enableMeanComodin !== false,
      substituteEnabled: status.tournamentInfo.enableSubstituteComodin !== false,
    };
  }, [status?.tournamentInfo]);

  // Cargar estado inicial
  useEffect(() => {
    if (roundId) {
      console.log(`🎲 useComodin: Iniciando para roundId=${roundId}`);
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
    // Estado principal
    status,
    eligiblePlayers,
    error,
    message,
    
    // Estados de loading
    isLoading,
    isApplying,
    isRevoking,
    isLoadingSubstitutes,
    
    // Funciones
    loadStatus,
    loadEligiblePlayers,
    applyComodin,
    revokeComodin,
    clearMessages,
    
    // Estados derivados
    canUse,
    isUsed,
    canRevoke,
    mode,
    points,
    substitutePlayer,
    comodinesConfig,
    
    // Validaciones
    canUseMode,
    getModeDisabledReason,
    validation,
  };
}