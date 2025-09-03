// components/player/UseComodinButton.tsx - VERSIÓN FINAL CON HOOK PERSONALIZADO
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useComodin } from "@/hooks/useComodin";

type Props = {
  roundId: string;
  disabled?: boolean;
  className?: string;
};

export default function UseComodinButton({ roundId, disabled, className }: Props) {
  const {
    status,
    eligiblePlayers,
    loading,
    error,
    message,
    loadEligiblePlayers,
    applyComodin,
    revokeComodin,
    clearMessages
  } = useComodin(roundId);

  // UI state local
  const [selectedMode, setSelectedMode] = useState<'mean' | 'substitute'>('mean');
  const [selectedSubstitute, setSelectedSubstitute] = useState<string>('');
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  // Cargar jugadores elegibles cuando se selecciona modo sustituto
  useEffect(() => {
    if (selectedMode === 'substitute' && !status?.used) {
      setLoadingPlayers(true);
      loadEligiblePlayers().finally(() => setLoadingPlayers(false));
    }
  }, [selectedMode, status?.used, loadEligiblePlayers]);

  const handleApplyComodin = async () => {
    if (selectedMode === 'substitute' && !selectedSubstitute) {
      return;
    }

    clearMessages();
    await applyComodin(selectedMode, selectedSubstitute);
  };

  const handleRevoke = async () => {
    clearMessages();
    await revokeComodin();
  };

  const handleModeChange = (mode: 'mean' | 'substitute') => {
    setSelectedMode(mode);
    if (mode === 'mean') {
      setSelectedSubstitute('');
    }
  };

  // Estado de carga
  if (loading && !status) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center justify-center py-4">
          <div className="text-sm text-gray-500">Cargando estado del comodín...</div>
        </div>
      </Card>
    );
  }

  // Error de carga
  if (error && !status) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded border-l-2 border-red-400">
          {error}
        </div>
      </Card>
    );
  }

  // No se pudo determinar estado
  if (!status) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="text-sm text-gray-500">
          No se pudo determinar el estado del comodín para esta ronda.
        </div>
      </Card>
    );
  }

  // CASO 1: Ya se usó el comodín - mostrar estado
  if (status.used) {
    return (
      <Card className={`p-4 bg-green-50 border-green-200 ${className}`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-green-800 flex items-center gap-2">
              <span className="text-green-600">✓</span>
              Comodín aplicado
            </h4>
            {status.canRevoke && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevoke}
                disabled={loading}
                className="text-red-600 hover:text-red-700 border-red-300"
              >
                {loading ? "Revocando..." : "Revocar"}
              </Button>
            )}
          </div>
          
          <div className="text-sm text-gray-700 space-y-1">
            <p><strong>Modo:</strong> {status.mode === 'mean' ? 'Media del grupo' : 'Sustituto'}</p>
            {status.mode === 'substitute' && status.substitutePlayer && (
              <p><strong>Sustituto:</strong> {status.substitutePlayer}</p>
            )}
            <p><strong>Puntos asignados:</strong> {(status.points || 0).toFixed(1)}</p>
            {status.appliedAt && (
              <p><strong>Aplicado:</strong> {new Date(status.appliedAt).toLocaleString('es-ES')}</p>
            )}
          </div>
          
          {status.reason && (
            <div className="text-xs bg-white p-2 rounded border-l-2 border-green-400 text-green-800">
              {status.reason}
            </div>
          )}

          {!status.canRevoke && status.restrictions && (
            <div className="text-xs bg-yellow-50 p-2 rounded border-l-2 border-yellow-400 text-yellow-800">
              <strong>No se puede revocar:</strong>
              {status.restrictions.hasConfirmedMatches && " Partidos con resultados confirmados."}
              {status.restrictions.hasUpcomingMatches && " Partidos programados en menos de 24h."}
              {status.restrictions.roundClosed && " La ronda está cerrada."}
            </div>
          )}
        </div>
      </Card>
    );
  }

  // CASO 2: No puede usar comodín - mostrar restricciones
  if (!status.canUse) {
    return (
      <Card className={`p-4 bg-gray-50 border-gray-200 ${className}`}>
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Comodín no disponible</h4>
          
          <div className="text-sm text-gray-600">
            {status.restrictionReason && (
              <div className="bg-yellow-50 p-2 rounded border-l-2 border-yellow-400 text-yellow-800">
                {status.restrictionReason}
              </div>
            )}
            
            {status.tournamentInfo && (
              <div className="mt-2 text-xs">
                Comodines usados: {status.tournamentInfo.comodinesUsed}/{status.tournamentInfo.maxComodines}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // CASO 3: Puede usar comodín - mostrar interfaz
  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Usar Comodín</h4>
        
        {status.tournamentInfo && (
          <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
            Tienes {status.tournamentInfo.comodinesRemaining} comodín disponible en este torneo
          </div>
        )}
        
        {/* Selector de modo */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Tipo de comodín</Label>
          <div className="space-y-3">
            <label className="flex items-start space-x-3 cursor-pointer p-2 rounded border border-gray-200 hover:bg-gray-50">
              <input
                type="radio"
                name="comodin-mode"
                value="mean"
                checked={selectedMode === 'mean'}
                onChange={(e) => handleModeChange(e.target.value as 'mean')}
                className="mt-1 text-blue-600"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">📊 Media del grupo</div>
                <div className="text-xs text-gray-500 mt-1">
                  Se asigna automáticamente la media del grupo (R1-R2) o tu media personal (desde R3)
                </div>
              </div>
            </label>
            
            <label className="flex items-start space-x-3 cursor-pointer p-2 rounded border border-gray-200 hover:bg-gray-50">
              <input
                type="radio"
                name="comodin-mode"
                value="substitute"
                checked={selectedMode === 'substitute'}
                onChange={(e) => handleModeChange(e.target.value as 'substitute')}
                className="mt-1 text-blue-600"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">🔄 Jugador sustituto</div>
                <div className="text-xs text-gray-500 mt-1">
                  Un jugador de grupo inferior jugará por ti. Los puntos se te asignan a ti y el suplente recibe crédito Ironman
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Selector de sustituto */}
        {selectedMode === 'substitute' && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Seleccionar sustituto</Label>
            {loadingPlayers ? (
              <div className="text-sm text-gray-500 p-2 bg-gray-50 rounded">
                Cargando jugadores disponibles...
              </div>
            ) : eligiblePlayers.length > 0 ? (
              <select
                value={selectedSubstitute}
                onChange={(e) => setSelectedSubstitute(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Seleccionar sustituto --</option>
                {eligiblePlayers.map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {player.name} (Grupo {player.groupNumber} - {player.points.toFixed(1)} pts)
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-gray-500 p-3 bg-yellow-50 border border-yellow-200 rounded">
                No hay jugadores disponibles como sustitutos en esta ronda
              </div>
            )}
          </div>
        )}

        {/* Información contextual */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h5 className="font-medium text-blue-900 text-sm mb-2">
            {selectedMode === 'mean' ? '📊 Información sobre media' : '🔄 Información sobre sustituto'}
          </h5>
          <div className="text-xs text-blue-700 space-y-1">
            {selectedMode === 'mean' ? (
              <>
                <p>• Se calcula automáticamente basado en tu historial</p>
                <p>• No cuenta como ronda jugada para el ranking oficial</p>
                <p>• Solo se puede usar 1 comodín por torneo</p>
              </>
            ) : (
              <>
                <p>• El sustituto debe estar en un grupo de nivel inferior al tuyo</p>
                <p>• Los puntos obtenidos se asignan a tu cuenta</p>
                <p>• El sustituto recibe crédito proporcional para el ranking Ironman</p>
                <p>• Revocable hasta 24 horas antes de cualquier partido programado</p>
              </>
            )}
          </div>
        </div>

        {/* Botón de aplicar */}
        <Button
          type="button"
          onClick={handleApplyComodin}
          disabled={
            disabled || 
            loading || 
            (selectedMode === 'substitute' && (!selectedSubstitute || eligiblePlayers.length === 0))
          }
          className="w-full"
        >
          {loading ? (
            "Aplicando..."
          ) : selectedMode === 'mean' ? (
            "Usar comodín (Media)"
          ) : (
            selectedSubstitute ? 
              `Usar comodín con ${eligiblePlayers.find(p => p.playerId === selectedSubstitute)?.name}` :
              "Seleccionar sustituto"
          )}
        </Button>

        {/* Mensajes de estado */}
        {message && (
          <div className="text-sm text-green-700 bg-green-50 p-3 rounded border-l-2 border-green-400">
            {message}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded border-l-2 border-red-400">
            {error}
          </div>
        )}
      </div>
    </Card>
  );
}