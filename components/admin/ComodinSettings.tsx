// components/admin/ComodinSettings.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings, Save, RefreshCw, AlertTriangle } from "lucide-react";

interface ComodinSettingsProps {
  tournamentId: string;
  tournamentName: string;
  /** Nuevo: notifica al padre para refrescar tras guardar con éxito */
  onSettingsChanged?: () => void;
}

interface TournamentComodinConfig {
  id: string;
  title: string;
  maxComodinesPerPlayer: number;
  enableMeanComodin: boolean;
  enableSubstituteComodin: boolean;
  substituteCreditFactor: number;
  substituteMaxAppearances: number;
}

export default function ComodinSettings({
  tournamentId,
  tournamentName,
  onSettingsChanged,
}: ComodinSettingsProps) {
  const [config, setConfig] = useState<TournamentComodinConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Cargar configuración actual
  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/tournaments/${tournamentId}/comodin-settings`);
      const data = await response.json();

      if (response.ok && data.success) {
        setConfig(data.tournament as TournamentComodinConfig);
      } else {
        setError(data.error || "Error al cargar configuración");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  // Guardar configuración
  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/tournaments/${tournamentId}/comodin-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxComodinesPerPlayer: config.maxComodinesPerPlayer,
          enableMeanComodin: config.enableMeanComodin,
          enableSubstituteComodin: config.enableSubstituteComodin,
          substituteCreditFactor: config.substituteCreditFactor,
          substituteMaxAppearances: config.substituteMaxAppearances,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setConfig(data.tournament as TournamentComodinConfig);
        setSuccess("Configuración guardada correctamente");
        // 🔔 Notificar al padre para refrescar (router.refresh())
        onSettingsChanged?.();
      } else {
        setError(data.error || "Error al guardar configuración");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  // Actualizar configuración local
  const updateConfig = (updates: Partial<TournamentComodinConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...updates });
  };

  // Validaciones
  const isValidConfig = () => {
    if (!config) return false;

    return (
      config.maxComodinesPerPlayer >= 0 &&
      config.maxComodinesPerPlayer <= 10 &&
      config.substituteCreditFactor >= 0 &&
      config.substituteCreditFactor <= 1 &&
      config.substituteMaxAppearances >= 1 &&
      (config.enableMeanComodin || config.enableSubstituteComodin)
    );
  };

  const hasUnsavedChanges = () => {
    // TODO: compara con estado inicial si quieres precisión.
    return true; // Simplificado
  };

  // Cargar al montar / cambiar de torneo
  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  // Auto-limpiar mensajes
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  if (loading && !config) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
            <span className="text-gray-500">Cargando configuración...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !config) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600">{error}</p>
            <Button onClick={loadConfig} variant="outline" className="mt-4">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!config) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Configuración de Comodines
        </CardTitle>
        <p className="text-sm text-gray-600">{tournamentName}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Límite por jugador */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comodines por jugador
          </label>
          <Input
            type="number"
            min="0"
            max="10"
            value={config.maxComodinesPerPlayer}
            onChange={(e) =>
              updateConfig({
                maxComodinesPerPlayer: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
              })
            }
            className="w-32"
          />
          <p className="text-xs text-gray-500 mt-1">
            Número máximo de comodines que cada jugador puede usar en este torneo (0-10)
          </p>
        </div>

        {/* Tipos de comodines habilitados */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Tipos de comodines habilitados</h4>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">Comodín de Media</span>
                  <Badge variant={config.enableMeanComodin ? "default" : "secondary"}>
                    {config.enableMeanComodin ? "Habilitado" : "Deshabilitado"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  Aplica automáticamente la puntuación promedio del jugador
                </p>
              </div>
              <Switch
                checked={config.enableMeanComodin}
                onCheckedChange={(checked) => updateConfig({ enableMeanComodin: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">Comodín de Sustituto</span>
                  <Badge variant={config.enableSubstituteComodin ? "default" : "secondary"}>
                    {config.enableSubstituteComodin ? "Habilitado" : "Deshabilitado"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  Permite que otro jugador de grupo inferior actúe como sustituto
                </p>
              </div>
              <Switch
                checked={config.enableSubstituteComodin}
                onCheckedChange={(checked) => updateConfig({ enableSubstituteComodin: checked })}
              />
            </div>
          </div>
        </div>

        {/* Configuración avanzada de sustitutos */}
        {config.enableSubstituteComodin && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
            <h5 className="font-medium text-gray-900">Configuración avanzada de sustitutos</h5>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Factor de crédito Ironman
              </label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.substituteCreditFactor}
                  onChange={(e) =>
                    updateConfig({
                      substituteCreditFactor: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)),
                    })
                  }
                  className="w-24"
                />
                <span className="text-sm text-gray-600">
                  ({Math.round(config.substituteCreditFactor * 100)}% de los puntos del titular)
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Porcentaje de puntos que recibe el sustituto para el ranking Ironman (0.0 - 1.0)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Máximo apariciones como sustituto
              </label>
              <Input
                type="number"
                min="1"
                max="10"
                value={config.substituteMaxAppearances}
                onChange={(e) =>
                  updateConfig({
                    substituteMaxAppearances: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)),
                  })
                }
                className="w-24"
              />
              <p className="text-xs text-gray-500 mt-1">
                Número máximo de veces que un jugador puede actuar como sustituto en este torneo
              </p>
            </div>
          </div>
        )}

        {/* Validaciones y advertencias */}
        {!config.enableMeanComodin && !config.enableSubstituteComodin && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Advertencia</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              Debe habilitar al menos un tipo de comodín para que los jugadores puedan usarlos.
            </p>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button onClick={loadConfig} variant="outline" disabled={loading} className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>

          <div className="flex gap-2">
            <Button onClick={saveConfig} disabled={saving || !isValidConfig()} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </div>

        {/* Mensajes de estado */}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Información adicional */}
        <div className="text-xs text-gray-500 space-y-1 pt-4 border-t">
          <p>💡 Los cambios en la configuración se aplican inmediatamente a todo el torneo.</p>
          <p>⚠️ Los jugadores que ya hayan usado comodines no se ven afectados por cambios retroactivos.</p>
          <p>🔄 La configuración se puede modificar en cualquier momento durante el torneo.</p>
        </div>
      </CardContent>
    </Card>
  );
}
