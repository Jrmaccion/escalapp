// lib/api/comodin.ts - VERSIÓN MEJORADA COMPLETA
// Cliente front para API de comodines con manejo robusto de errores

// Tipos base expandidos
export type ComodinStatus = {
  used: boolean;
  mode: "mean" | "substitute" | null;
  canUse: boolean;
  canRevoke?: boolean;
  message?: string | null;
  restrictionReason?: string | null;
  reason?: string | null;
  points?: number | null;
  appliedAt?: string | null;
  substitutePlayer?: string | null;
  substitutePlayerId?: string | null;
  tournamentInfo?: {
    maxComodines: number;
    comodinesUsed: number;
    comodinesRemaining: number;
    // Propiedades extendidas opcionales
    enableMeanComodin?: boolean;
    enableSubstituteComodin?: boolean;
    substituteCreditFactor?: number;
    substituteMaxAppearances?: number;
  };
  restrictions?: {
    hasConfirmedMatches?: boolean;
    hasUpcomingMatches?: boolean;
    roundClosed?: boolean;
  };
};

export type PlayerComodinStatus = {
  playerId: string;
  playerName: string;
  groupNumber: number;
  usedComodin: boolean;
  comodinMode: "mean" | "substitute" | null;
  substitutePlayerId?: string | null;
  substitutePlayerName?: string | null;
  points?: number;
  appliedAt?: string | null;
  canRevoke: boolean;
  restrictionReason?: string | null;
  comodinReason?: string | null;
};

export type RoundComodinStats = {
  roundId: string;
  totalPlayers: number;
  withComodin: number;
  revocables: number;
  players: PlayerComodinStatus[];
};

export type EligibleSubstitutesResponse = {
  success: boolean;
  players: Array<{
    id: string;
    name: string;
    groupNumber: number;
    groupLevel: number;
    points: number;
  }>;
  currentGroup?: {
    number: number;
    level: number;
  };
  isLastGroup?: boolean;
  substitutionDirection?: "up" | "down";
  message?: string;
};

// Tipos de respuesta de la API
type ApiResponse<T = any> = T & { 
  success?: boolean; 
  message?: string;
  error?: string;
};

type ApiError = { 
  error?: string; 
  message?: string;
  code?: string;
  details?: any;
};

// Clase personalizada para errores de comodín
export class ComodinApiError extends Error {
  public code?: string;
  public details?: any;
  public status?: number;

  constructor(message: string, code?: string, status?: number, details?: any) {
    super(message);
    this.name = 'ComodinApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Función helper para manejo robusto de respuestas
async function handleApiResponse<T>(response: Response): Promise<T> {
  let data: ApiResponse<T> & ApiError;
  
  try {
    data = await response.json();
  } catch (parseError) {
    throw new ComodinApiError(
      `Error parsing response: ${parseError}`,
      'PARSE_ERROR',
      response.status
    );
  }

  if (!response.ok) {
    const errorMessage = data?.error || data?.message || `HTTP ${response.status}`;
    const errorCode = data?.code || response.status.toString();
    
    throw new ComodinApiError(
      errorMessage,
      errorCode,
      response.status,
      data?.details
    );
  }

  return data as T;
}

// Función helper para requests con timeout y retry
async function fetchWithRetry(
  url: string, 
  options: RequestInit = {}, 
  retries: number = 2,
  timeout: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const fetchOptions: RequestInit = {
    ...options,
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new ComodinApiError('Request timeout', 'TIMEOUT');
    }
    
    if (retries > 0 && (error.name === 'TypeError' || error.code === 'NETWORK_ERROR')) {
      console.warn(`Request failed, retrying... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(url, options, retries - 1, timeout);
    }
    
    throw new ComodinApiError(
      error.message || 'Network error',
      'NETWORK_ERROR'
    );
  }
}

// API client principal
export const comodinApi = {
  // Estado del jugador
  async getStatus(roundId: string): Promise<ComodinStatus> {
    if (!roundId?.trim()) {
      throw new ComodinApiError('roundId is required', 'MISSING_ROUND_ID');
    }

    const response = await fetchWithRetry(
      `/api/comodin/status?roundId=${encodeURIComponent(roundId)}`,
      { 
        method: 'GET',
        cache: 'no-store' 
      }
    );
    
    return handleApiResponse<ComodinStatus>(response);
  },

  // Candidatos a sustituto
  async eligibleSubstitutes(roundId: string): Promise<EligibleSubstitutesResponse> {
    if (!roundId?.trim()) {
      throw new ComodinApiError('roundId is required', 'MISSING_ROUND_ID');
    }

    const response = await fetchWithRetry(
      `/api/comodin/eligible-substitutes?roundId=${encodeURIComponent(roundId)}`,
      { 
        method: 'GET',
        cache: 'no-store' 
      }
    );
    
    return handleApiResponse<EligibleSubstitutesResponse>(response);
  },

  // APLICAR comodín de media
  async applyMean(roundId: string): Promise<ApiResponse<{ message?: string; points?: number }>> {
    if (!roundId?.trim()) {
      throw new ComodinApiError('roundId is required', 'MISSING_ROUND_ID');
    }

    const response = await fetchWithRetry(`/api/comodin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId, mode: "mean" }),
    });
    
    return handleApiResponse(response);
  },

  // APLICAR comodín de sustituto
  async applySubstitute(
    roundId: string, 
    substitutePlayerId: string
  ): Promise<ApiResponse<{ message?: string; substitutePlayer?: string }>> {
    if (!roundId?.trim()) {
      throw new ComodinApiError('roundId is required', 'MISSING_ROUND_ID');
    }
    if (!substitutePlayerId?.trim()) {
      throw new ComodinApiError('substitutePlayerId is required', 'MISSING_SUBSTITUTE_ID');
    }

    const response = await fetchWithRetry(`/api/comodin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId, mode: "substitute", substitutePlayerId }),
    });
    
    return handleApiResponse(response);
  },

  // REVOCAR comodín (jugador propio)
  async revoke(roundId: string): Promise<ApiResponse<{ message?: string }>> {
    if (!roundId?.trim()) {
      throw new ComodinApiError('roundId is required', 'MISSING_ROUND_ID');
    }

    const response = await fetchWithRetry(`/api/comodin/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId }),
    });
    
    return handleApiResponse(response);
  },

  // ADMIN: Revocar comodín de otro jugador
  async adminRevoke(
    roundId: string, 
    playerId: string
  ): Promise<ApiResponse<{ message?: string; playerName?: string }>> {
    if (!roundId?.trim()) {
      throw new ComodinApiError('roundId is required', 'MISSING_ROUND_ID');
    }
    if (!playerId?.trim()) {
      throw new ComodinApiError('playerId is required', 'MISSING_PLAYER_ID');
    }

    const response = await fetchWithRetry(`/api/comodin/revoke`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId, playerId }),
    });
    
    return handleApiResponse(response);
  },

  // ADMIN: Estadísticas de ronda
  async getRoundStats(roundId: string): Promise<RoundComodinStats> {
    if (!roundId?.trim()) {
      throw new ComodinApiError('roundId is required', 'MISSING_ROUND_ID');
    }

    const response = await fetchWithRetry(
      `/api/comodin/round-stats?roundId=${encodeURIComponent(roundId)}`,
      { 
        method: 'GET',
        cache: 'no-store' 
      }
    );
    
    return handleApiResponse<RoundComodinStats>(response);
  },

  // Utilidades adicionales

  // Validar si un jugador puede usar comodín (cliente)
  validateCanUseComodin(status: ComodinStatus | null): { 
    canUse: boolean; 
    reason?: string;
    suggestions?: string[];
  } {
    if (!status) {
      return { 
        canUse: false, 
        reason: 'No se pudo cargar el estado del comodín' 
      };
    }

    if (status.used) {
      return { 
        canUse: false, 
        reason: 'Ya has usado comodín en esta ronda',
        suggestions: status.canRevoke ? ['Puedes revocar el comodín actual'] : []
      };
    }

    if (!status.canUse) {
      return { 
        canUse: false, 
        reason: status.restrictionReason || 'No cumples los requisitos para usar comodín',
        suggestions: [
          'Verifica que no tengas partidos confirmados',
          'Asegúrate de no tener partidos programados en menos de 24 horas',
          'Confirma que tienes comodines disponibles'
        ]
      };
    }

    return { canUse: true };
  },

  // Calcular tiempo restante para revocación
  calculateRevocationDeadline(status: ComodinStatus | null): {
    canRevoke: boolean;
    timeLeft?: number;
    deadline?: Date;
    reason?: string;
  } {
    if (!status?.used) {
      return { canRevoke: false, reason: 'No hay comodín activo' };
    }

    if (status.canRevoke) {
      return { canRevoke: true };
    }

    // Si hay restricciones específicas, proporcionar información detallada
    if (status.restrictions) {
      let reason = 'No se puede revocar: ';
      const reasons = [];
      
      if (status.restrictions.hasConfirmedMatches) {
        reasons.push('tienes partidos confirmados');
      }
      if (status.restrictions.hasUpcomingMatches) {
        reasons.push('tienes partidos programados en menos de 24 horas');
      }
      if (status.restrictions.roundClosed) {
        reasons.push('la ronda está cerrada');
      }

      reason += reasons.join(', ');
      return { canRevoke: false, reason };
    }

    return { canRevoke: false, reason: 'No se puede revocar el comodín' };
  },

  // Formatear información del comodín para mostrar
  formatComodinInfo(status: ComodinStatus | null): {
    title: string;
    description: string;
    type?: 'success' | 'warning' | 'info' | 'error';
    actions?: Array<{ label: string; action: string }>;
  } {
    if (!status) {
      return {
        title: 'Estado desconocido',
        description: 'No se pudo cargar la información del comodín',
        type: 'error'
      };
    }

    if (status.used) {
      const modeText = status.mode === 'mean' ? 'Media del grupo' : 'Sustituto';
      const pointsText = status.points ? ` (${status.points.toFixed(1)} puntos)` : '';
      
      return {
        title: `Comodín aplicado: ${modeText}`,
        description: `${status.reason || 'Comodín activo'}${pointsText}`,
        type: 'success',
        actions: status.canRevoke ? [{ label: 'Revocar', action: 'revoke' }] : []
      };
    }

    if (!status.canUse) {
      return {
        title: 'Comodín no disponible',
        description: status.restrictionReason || 'No puedes usar comodín en esta ronda',
        type: 'warning'
      };
    }

    const remaining = status.tournamentInfo?.comodinesRemaining || 0;
    return {
      title: 'Comodín disponible',
      description: `Tienes ${remaining} comodín${remaining !== 1 ? 'es' : ''} disponible${remaining !== 1 ? 's' : ''}`,
      type: 'info',
      actions: [
        { label: 'Usar Media', action: 'apply_mean' },
        { label: 'Usar Sustituto', action: 'apply_substitute' }
      ]
    };
  }
};

// Export tipos útiles adicionales
export type ComodinMode = 'mean' | 'substitute';
export type ComodinAction = 'apply_mean' | 'apply_substitute' | 'revoke';

// Helper para detectar errores específicos
export const isComodinError = (error: any): error is ComodinApiError => {
  return error instanceof ComodinApiError;
};

// Helper para obtener mensaje de error amigable
export const getComodinErrorMessage = (error: any): string => {
  if (isComodinError(error)) {
    return error.message;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return 'Error desconocido al procesar la solicitud';
};