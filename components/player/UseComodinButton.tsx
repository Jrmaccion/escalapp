// components/player/UseComodinButton.tsx - VERSIÓN CORREGIDA
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  X, 
  Star, 
  Users, 
  RotateCcw,
  Zap,
  UserCheck,
  Loader2
} from "lucide-react";
import { useComodin } from "@/hooks/useComodin";

type UseComodinButtonProps = {
  roundId: string;
  refreshTrigger?: number;
  onActionComplete?: () => void;
  className?: string;
  disabled?: boolean;
  showDetails?: boolean;
};

export default function UseComodinButton({
  roundId,
  refreshTrigger = 0,
  onActionComplete,
  className = "",
  disabled = false,
  showDetails = true
}: UseComodinButtonProps) {
  const [showSubstituteForm, setShowSubstituteForm] = useState(false);
  const [selectedSubstitute, setSelectedSubstitute] = useState<string>("");
  const [showModeSelector, setShowModeSelector] = useState(false);

  const {
    status,
    eligiblePlayers,
    error,
    message,
    isLoading,
    isApplying,
    isRevoking,
    isLoadingSubstitutes,
    loadEligiblePlayers,
    applyComodin,
    revokeComodin,
    canUseMode,
    getModeDisabledReason,
    validation,
    canUse,
    isUsed,
    canRevoke,
    mode,
    points,
    substitutePlayer,
    clearMessages,
    comodinesConfig
  } = useComodin(roundId);

  // Debug para identificar problemas
  useEffect(() => {
    console.log("🎲 UseComodinButton - Estado:", {
      roundId,
      hasStatus: !!status,
      canUse,
      isUsed,
      error,
      isLoading
    });
  }, [roundId, status, canUse, isUsed, error, isLoading]);

  // Responder a refreshTrigger
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log("🔄 UseComodinButton: Refresh trigger activado");
      clearMessages();
    }
  }, [refreshTrigger, clearMessages]);

  // Aplicar comodín con manejo de errores mejorado
  const handleApplyComodin = async (comodinMode: 'mean' | 'substitute') => {
    try {
      console.log(`🎯 Aplicando comodín ${comodinMode}`);
      
      let result;
      if (comodinMode === 'mean') {
        result = await applyComodin('mean');
      } else if (comodinMode === 'substitute') {
        if (!selectedSubstitute) {
          console.warn("⚠️ No hay sustituto seleccionado");
          return;
        }
        result = await applyComodin('substitute', selectedSubstitute);
      }

      if (result?.success) {
        console.log("✅ Comodín aplicado exitosamente");
        setShowModeSelector(false);
        setShowSubstituteForm(false);
        setSelectedSubstitute("");
        onActionComplete?.();
      } else {
        console.error("❌ Error aplicando comodín:", result?.error);
      }
    } catch (err) {
      console.error("❌ Error inesperado aplicando comodín:", err);
    }
  };

  // Revocar comodín
  const handleRevokeComodin = async () => {
    try {
      console.log("🔄 Revocando comodín");
      const result = await revokeComodin();
      if (result?.success) {
        console.log("✅ Comodín revocado exitosamente");
        onActionComplete?.();
      } else {
        console.error("❌ Error revocando comodín:", result?.error);
      }
    } catch (err) {
      console.error("❌ Error inesperado revocando comodín:", err);
    }
  };

  // Mostrar formulario de sustituto
  const handleShowSubstituteForm = async () => {
    setShowSubstituteForm(true);
    if (eligiblePlayers.length === 0) {
      console.log("👥 Cargando jugadores elegibles...");
      await loadEligiblePlayers();
    }
  };

  // Estado de carga inicial
  if (isLoading && !status) {
    return (
      <Card className={`${className} border-gray-200 bg-gray-50`}>
        <CardContent className="p-4 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Cargando comodín...</p>
        </CardContent>
      </Card>
    );
  }

  // Error crítico - no hay estado
  if (!status && !isLoading) {
    return (
      <Card className={`${className} border-red-200 bg-red-50`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm text-red-800 font-medium">
                Error cargando comodín
              </p>
              <p className="text-xs text-red-700 mt-1">
                roundId: {roundId || 'undefined'}
              </p>
              {error && (
                <p className="text-xs text-red-700 mt-1">
                  {error}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} ${
      isUsed 
        ? 'border-green-200 bg-green-50' 
        : canUse 
          ? 'border-blue-200 bg-blue-50' 
          : 'border-gray-200 bg-gray-50'
    }`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Star className="w-5 h-5" />
          Sistema de Comodín
          {comodinesConfig && (
            <Badge variant="outline" className="text-xs">
              {comodinesConfig.comodinesRemaining}/{comodinesConfig.maxComodines} disponibles
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mensajes de error/éxito */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-800">{error}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearMessages}
                  className="mt-1 h-auto p-1 text-red-700"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-green-800">{message}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearMessages}
                  className="mt-1 h-auto p-1 text-green-700"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Estado actual del comodín */}
        {isUsed && (
          <div className="p-4 bg-green-100 border border-green-300 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-900">Comodín Aplicado</span>
            </div>
            <div className="text-sm text-green-800">
              {mode === 'substitute' && substitutePlayer ? (
                <p><strong>Suplente:</strong> {substitutePlayer} jugará por ti</p>
              ) : (
                <p><strong>Puntos asignados:</strong> {points.toFixed(1)}</p>
              )}
            </div>
            
            {canRevoke && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRevokeComodin}
                disabled={isRevoking || disabled}
                className="mt-3 border-green-400 text-green-700 hover:bg-green-200"
              >
                {isRevoking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Revocando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Revocar Comodín
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Controles para aplicar comodín */}
        {!isUsed && canUse && (
          <div className="space-y-3">
            {!showModeSelector && (
              <Button
                onClick={() => setShowModeSelector(true)}
                disabled={isApplying || disabled}
                className="w-full"
              >
                <Zap className="w-4 h-4 mr-2" />
                Usar Comodín
              </Button>
            )}

            {showModeSelector && (
              <div className="space-y-3 p-4 bg-blue-100 border border-blue-300 rounded-lg">
                <h4 className="font-medium text-blue-900">Selecciona el tipo de comodín:</h4>
                
                <div className="space-y-2">
                  {/* Comodín de media */}
                  <div className="flex items-center justify-between p-3 bg-white rounded border">
                    <div>
                      <div className="font-medium">Comodín de Media</div>
                      <div className="text-sm text-gray-600">Se asignan puntos basados en tu historial</div>
                    </div>
                    {canUseMode('mean') ? (
                      <Button
                        size="sm"
                        onClick={() => handleApplyComodin('mean')}
                        disabled={isApplying || disabled}
                      >
                        {isApplying ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Aplicando...
                          </>
                        ) : (
                          "Usar"
                        )}
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {getModeDisabledReason('mean')}
                      </Badge>
                    )}
                  </div>

                  {/* Comodín de sustituto */}
                  <div className="flex items-center justify-between p-3 bg-white rounded border">
                    <div>
                      <div className="font-medium">Comodín de Sustituto</div>
                      <div className="text-sm text-gray-600">Un jugador de nivel superior juega por ti</div>
                    </div>
                    {canUseMode('substitute') ? (
                      <Button
                        size="sm"
                        onClick={handleShowSubstituteForm}
                        disabled={isApplying || disabled}
                      >
                        <Users className="w-4 h-4 mr-1" />
                        Elegir
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {getModeDisabledReason('substitute')}
                      </Badge>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowModeSelector(false)}
                  className="w-full"
                  disabled={isApplying}
                >
                  Cancelar
                </Button>
              </div>
            )}

            {/* Formulario de selección de sustituto */}
            {showSubstituteForm && (
              <div className="space-y-3 p-4 bg-purple-100 border border-purple-300 rounded-lg">
                <h4 className="font-medium text-purple-900">Selecciona un sustituto:</h4>
                
                {isLoadingSubstitutes ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-purple-600">Cargando jugadores elegibles...</p>
                  </div>
                ) : eligiblePlayers.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-purple-800">No hay jugadores elegibles como sustitutos</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {eligiblePlayers.map((player) => (
                      <div key={player.id} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id={`substitute-${player.id}`}
                          name="substitute"
                          value={player.id}
                          checked={selectedSubstitute === player.id}
                          onChange={(e) => setSelectedSubstitute(e.target.value)}
                          className="text-purple-600"
                        />
                        <label 
                          htmlFor={`substitute-${player.id}`}
                          className="flex-1 text-sm cursor-pointer p-2 rounded hover:bg-white/50"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{player.name}</span>
                            <span className="text-xs text-purple-700">Grupo {player.groupNumber}</span>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApplyComodin('substitute')}
                    disabled={!selectedSubstitute || isApplying || disabled}
                    className="flex-1"
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Aplicando...
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Confirmar Sustituto
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowSubstituteForm(false);
                      setSelectedSubstitute("");
                    }}
                    disabled={isApplying}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estado no disponible */}
        {!canUse && !isUsed && (
          <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">Comodín No Disponible</span>
            </div>
            {validation.issues.map((issue, index) => (
              <div key={index} className="text-sm text-gray-700 mb-1">
                • {issue.message}
              </div>
            ))}
          </div>
        )}

        {/* Información adicional */}
        {showDetails && comodinesConfig && (
          <div className="text-xs text-gray-600 space-y-1 pt-3 border-t border-gray-200">
            <p>• Comodines restantes en el torneo: {comodinesConfig.comodinesRemaining}</p>
            <p>• Comodín de media: {comodinesConfig.meanEnabled ? 'Habilitado' : 'Deshabilitado'}</p>
            <p>• Comodín de sustituto: {comodinesConfig.substituteEnabled ? 'Habilitado' : 'Deshabilitado'}</p>
            {process.env.NODE_ENV === 'development' && (
              <p className="text-red-500">• DEBUG: roundId={roundId}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}