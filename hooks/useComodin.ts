// hooks/useComodin.ts
import { useState, useEffect, useCallback } from 'react';

export type ComodinStatus = {
  used: boolean;
  mode?: 'mean' | 'substitute';
  substitutePlayer?: string;
  points?: number;
  canRevoke?: boolean;
  canUse?: boolean;
  reason?: string;
  appliedAt?: string;
  restrictionReason?: string;
  tournamentInfo?: {
    comodinesUsed: number;
    maxComodines: number;
    comodinesRemaining: number;
  };
  groupInfo?: {
    groupNumber: number;
    points: number;
  };
  restrictions?: {
    hasConfirmedMatches: boolean;
    hasUpcomingMatches: boolean;
    roundClosed: boolean;
    nextMatchDate?: string;
  };
};

export type EligiblePlayer = {
  playerId: string;
  name: string;
  groupNumber: number;
  groupLevel: number;
  points: number;
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
      
      const response = await fetch(`/api/comodin/status?roundId=${roundId}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setStatus(data);
      } else {
        setError(data.error || 'Error al cargar estado del comodín');
        setStatus(null);
      }
    } catch (err) {
      setError('Error de conexión');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [roundId]);

  // Cargar jugadores elegibles
  const loadEligiblePlayers = useCallback(async () => {
    try {
      const response = await fetch(`/api/comodin/eligible-substitutes?roundId=${roundId}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setEligiblePlayers(data.players || []);
      } else {
        console.warn('No se pudieron cargar jugadores elegibles:', data.error);
        setEligiblePlayers([]);
      }
    } catch (err) {
      console.warn('Error cargando jugadores elegibles:', err);
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

      const payload: any = { roundId, mode };
      if (mode === 'substitute' && substitutePlayerId) {
        payload.substitutePlayerId = substitutePlayerId;
      }

      const response = await fetch('/api/comodin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage(data.message || 'Comodín aplicado exitosamente');
        // Recargar estado
        await loadStatus();
        return { success: true, data };
      } else {
        setError(data.error || 'Error al aplicar comodín');
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Error de conexión';
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

      const response = await fetch('/api/comodin/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage(data.message || 'Comodín revocado exitosamente');
        // Recargar estado
        await loadStatus();
        return { success: true, data };
      } else {
        setError(data.error || 'Error al revocar comodín');
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = 'Error de conexión';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [roundId, loadStatus]);

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
    clearMessages: () => {
      setError(null);
      setMessage(null);
    }
  };
}