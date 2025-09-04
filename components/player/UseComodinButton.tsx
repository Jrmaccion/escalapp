// components/player/UseComodinButton.tsx - VERSIÓN COMPLETADA + refreshTrigger + onActionComplete
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Zap, Users, BarChart, RefreshCw } from "lucide-react";
import { comodinApi, ComodinStatus } from "@/lib/api/comodin";

type Props = {
  roundId: string;
  disabled?: boolean;
  className?: string;
  /** Nuevo: cuando cambie, el componente recargará el estado desde el backend */
  refreshTrigger?: number;
  /** Nuevo: callback tras aplicar o revocar el comodín con éxito */
  onActionComplete?: () => void;
};

type EligiblePlayer = {
  id: string;
  name: string;
  groupNumber: number;
};

export default function UseComodinButton({
  roundId,
  disabled,
  className,
  refreshTrigger,
  onActionComplete,
}: Props) {
  const [status, setStatus] = useState<ComodinStatus | null>(null);
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // UI state local
  const [selectedMode, setSelectedMode] = useState<"mean" | "substitute">("mean");
  const [selectedSubstitute, setSelectedSubstitute] = useState<string>("");

  // Cargar estado del comodín
  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const statusData = await comodinApi.getStatus(roundId);
      setStatus(statusData);
    } catch (err: any) {
      setError(err.message || "Error al cargar estado del comodín");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [roundId]);

  // Cargar jugadores elegibles
  const loadEligiblePlayers = useCallback(async () => {
    try {
      setLoadingPlayers(true);
      const data = await comodinApi.eligibleSubstitutes(roundId);
      setEligiblePlayers(data.players || []);
    } catch (err: any) {
      console.warn("Error cargando jugadores elegibles:", err.message);
      setEligiblePlayers([]);
    } finally {
      setLoadingPlayers(false);
    }
  }, [roundId]);

  // Aplicar comodín
  const applyComodin = async () => {
    if (!canUseMode(selectedMode)) return;
    if (selectedMode === "substitute" && !selectedSubstitute) return;

    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      let result;
      if (selectedMode === "mean") {
        result = await comodinApi.applyMean(roundId);
      } else {
        result = await comodinApi.applySubstitute(roundId, selectedSubstitute);
      }

      setMessage(result.message || "Comodín aplicado exitosamente");
      await loadStatus();
      // Notificar al padre (para refrescar su vista)
      onActionComplete?.();
    } catch (err: any) {
      setError(err.message || "Error al aplicar comodín");
    } finally {
      setLoading(false);
    }
  };

  // Revocar comodín
  const revokeComodin = async () => {
    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const result = await comodinApi.revoke(roundId);
      setMessage(result.message || "Comodín revocado exitosamente");
      await loadStatus();
      // Notificar al padre (para refrescar su vista)
      onActionComplete?.();
    } catch (err: any) {
      setError(err.message || "Error al revocar comodín");
    } finally {
      setLoading(false);
    }
  };

  // Validar si puede usar un modo específico
  const canUseMode = (mode: "mean" | "substitute") => {
    if (!status || !status.canUse) return false;

    // Si no hay tournamentInfo, asumir que ambos están habilitados (compatibilidad)
    if (!status.tournamentInfo) return true;

    // Verificar configuración específica (cuando esté disponible)
    if (mode === "mean") {
      return (status.tournamentInfo as any).enableMeanComodin !== false;
    }

    if (mode === "substitute") {
      return (status.tournamentInfo as any).enableSubstituteComodin !== false;
    }

    return true;
  };

  // Obtener razón de deshabilitación
  const getModeDisabledReason = (mode: "mean" | "substitute") => {
    if (!status?.tournamentInfo) return "Configuración no disponible";

    const tournamentInfo = status.tournamentInfo as any;

    if (mode === "mean" && tournamentInfo.enableMeanComodin === false) {
      return "El comodín de media está deshabilitado en este torneo";
    }

    if (mode === "substitute" && tournamentInfo.enableSubstituteComodin === false) {
      return "El comodín de sustituto está deshabilitado en este torneo";
    }

    return null;
  };

  // Cargar jugadores elegibles cuando se selecciona modo sustituto
  useEffect(() => {
    if (selectedMode === "substitute" && !status?.used && canUseMode("substitute")) {
      loadEligiblePlayers();
    }
  }, [selectedMode, status?.used, loadEligiblePlayers]);

  // Auto-seleccionar modo válido disponible
  useEffect(() => {
    if (status && !status.used) {
      if (selectedMode === "mean" && !canUseMode("mean") && canUseMode("substitute")) {
        setSelectedMode("substitute");
      } else if (selectedMode === "substitute" && !canUseMode("substitute") && canUseMode("mean")) {
        setSelectedMode("mean");
      }
    }
  }, [status, selectedMode]);

  // Cargar estado inicial
  useEffect(() => {
    if (roundId) {
      loadStatus();
    }
  }, [roundId, loadStatus]);

  // NUEVO: re-cargar estado si cambia refreshTrigger (forzado desde el padre)
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      // no necesitamos esperar, pero protegemos por roundId
      if (roundId) void loadStatus();
    }
  }, [refreshTrigger, roundId, loadStatus]);

  // Auto-limpiar mensajes
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  const handleModeChange = (mode: "mean" | "substitute") => {
    if (canUseMode(mode)) {
      setSelectedMode(mode);
      if (mode === "mean") {
        setSelectedSubstitute("");
      }
    }
  };

  // Estado de carga
  if (loading && !status) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-4 h-4 animate-spin text-gray-400 mr-2" />
          <span className="text-sm text-gray-500">Cargando estado del comodín...</span>
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
        <div className="text-sm text-gray-500">No se pudo determinar el estado del comodín para esta ronda.</div>
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
              <Zap className="w-4 h-4 text-green-600" />
              Comodín aplicado
            </h4>
            {status.canRevoke && (
              <Button
                variant="outline"
                size="sm"
                onClick={revokeComodin}
                disabled={loading}
                className="text-red-600 hover:text-red-700 border-red-300"
              >
                {loading ? "Revocando..." : "Revocar"}
              </Button>
            )}
          </div>

          <div className="text-sm text-gray-700 space-y-1">
            <p>
              <strong>Modo:</strong> {status.mode === "mean" ? "Media del grupo" : "Sustituto"}
            </p>
            {status.mode === "substitute" && status.substitutePlayer && (
              <p>
                <strong>Sustituto:</strong> {status.substitutePlayer}
              </p>
            )}
            <p>
              <strong>Puntos asignados:</strong> {(status.points || 0).toFixed(1)}
            </p>
            {status.appliedAt && <p><strong>Aplicado:</strong> {new Date(status.appliedAt).toLocaleString("es-ES")}</p>}
          </div>

          {status.reason && (
            <div className="text-xs bg-white p-2 rounded border-l-2 border-green-400 text-green-8 00">
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
          <h4 className="font-medium text-gray-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Comodín no disponible
          </h4>

          <div className="text-sm text-gray-600">
            {status.restrictionReason && (
              <div className="bg-yellow-50 p-2 rounded border-l-2 border-yellow-400 text-yellow-800">
                {status.restrictionReason}
              </div>
            )}

            {status.tournamentInfo && (
              <div className="mt-2 text-xs bg-blue-50 p-2 rounded">
                <p>
                  Comodines en este torneo: {status.tournamentInfo.comodinesUsed}/
                  {status.tournamentInfo.maxComodines}
                </p>
                {status.tournamentInfo.comodinesRemaining === 0 && (
                  <p className="text-red-600 font-medium">Has agotado tus comodines disponibles</p>
                )}
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
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Usar Comodín
          </h4>
          {status.tournamentInfo && (
            <Badge variant="outline" className="text-xs">
              {status.tournamentInfo.comodinesRemaining}/{status.tournamentInfo.maxComodines} disponibles
            </Badge>
          )}
        </div>

        {/* Selector de modo */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Tipo de comodín</Label>
          <div className="space-y-3">
            {/* Opción de media */}
            <label
              className={`flex items-start space-x-3 cursor-pointer p-3 rounded border transition-colors ${
                canUseMode("mean") ? "border-gray-200 hover:bg-gray-50" : "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
              }`}
            >
              <input
                type="radio"
                name="comodin-mode"
                value="mean"
                checked={selectedMode === "mean"}
                onChange={(e) => handleModeChange(e.target.value as "mean")}
                disabled={!canUseMode("mean")}
                className="mt-1 text-blue-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <BarChart className="w-4 h-4" />
                  <span className="text-sm font-medium">Media del grupo</span>
                  {!canUseMode("mean") && <Badge variant="secondary" className="text-xs">Deshabilitado</Badge>}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {canUseMode("mean")
                    ? "Se asigna automáticamente la media del grupo (R1-R2) o tu media personal (desde R3)"
                    : getModeDisabledReason("mean")}
                </div>
              </div>
            </label>

            {/* Opción de sustituto */}
            <label
              className={`flex items-start space-x-3 cursor-pointer p-3 rounded border transition-colors ${
                canUseMode("substitute")
                  ? "border-gray-200 hover:bg-gray-50"
                  : "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
              }`}
            >
              <input
                type="radio"
                name="comodin-mode"
                value="substitute"
                checked={selectedMode === "substitute"}
                onChange={(e) => handleModeChange(e.target.value as "substitute")}
                disabled={!canUseMode("substitute")}
                className="mt-1 text-blue-600"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium">Jugador sustituto</span>
                  {!canUseMode("substitute") && <Badge variant="secondary" className="text-xs">Deshabilitado</Badge>}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {canUseMode("substitute")
                    ? "Un jugador de grupo inferior juega por ti. Los puntos se te asignan a ti y el suplente recibe crédito Ironman"
                    : getModeDisabledReason("substitute")}
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Selector de sustituto */}
        {selectedMode === "substitute" && canUseMode("substitute") && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Seleccionar sustituto</Label>
            {loadingPlayers ? (
              <div className="text-sm text-gray-500 p-2 bg-gray-50 rounded">Cargando jugadores disponibles...</div>
            ) : eligiblePlayers.length > 0 ? (
              <select
                value={selectedSubstitute}
                onChange={(e) => setSelectedSubstitute(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Seleccionar sustituto --</option>
                {eligiblePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} (Grupo {player.groupNumber})
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
            {selectedMode === "mean" ? "Información sobre media" : "Información sobre sustituto"}
          </h5>
          <div className="text-xs text-blue-700 space-y-1">
            {selectedMode === "mean" ? (
              <>
                <p>• Se calcula automáticamente basado en tu historial</p>
                <p>• No cuenta como ronda jugada para el ranking oficial</p>
                <p>• Solo se puede usar {status.tournamentInfo?.maxComodines || 1} comodín por torneo</p>
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

        {/* Mostrar configuración del torneo */}
        {status.tournamentInfo && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <h5 className="font-medium text-gray-700 text-sm mb-2">Configuración del torneo</h5>
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Límite por jugador:</span>
                <span className="font-medium">{status.tournamentInfo.maxComodines} comodines</span>
              </div>
              <div className="flex justify-between">
                <span>Ya usaste:</span>
                <span className="font-medium">{status.tournamentInfo.comodinesUsed}</span>
              </div>
              <div className="flex justify-between">
                <span>Disponibles:</span>
                <span className="font-medium text-green-600">{status.tournamentInfo.comodinesRemaining}</span>
              </div>
            </div>
          </div>
        )}

        {/* Botón de aplicar */}
        <Button
          type="button"
          onClick={applyComodin}
          disabled={
            disabled ||
            loading ||
            !canUseMode(selectedMode) ||
            (selectedMode === "substitute" && (!selectedSubstitute || eligiblePlayers.length === 0))
          }
          className="w-full"
        >
          {loading
            ? "Aplicando..."
            : !canUseMode(selectedMode)
            ? `${selectedMode === "mean" ? "Media" : "Sustituto"} deshabilitado`
            : selectedMode === "mean"
            ? "Usar comodín (Media)"
            : selectedSubstitute
            ? `Usar comodín con ${eligiblePlayers.find((p) => p.id === selectedSubstitute)?.name}`
            : "Seleccionar sustituto"}
        </Button>

        {/* Mensajes de estado */}
        {message && (
          <div className="text-sm text-green-700 bg-green-50 p-3 rounded border-l-2 border-green-400">{message}</div>
        )}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded border-l-2 border-red-400">{error}</div>
        )}
      </div>
    </Card>
  );
}
