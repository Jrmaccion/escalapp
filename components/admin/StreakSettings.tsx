// components/admin/StreakSettings.tsx - ACTUALIZADO para API con nombres legacy
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Save, RefreshCw, AlertTriangle, Target, Calendar } from "lucide-react";

interface ContinuitySettingsProps {
  tournamentId: string;
  tournamentName: string;
  onSettingsChanged?: () => void;
}

interface TournamentContinuityConfig {
  id: string;
  title: string;
  continuityEnabled: boolean;
  continuityPointsPerSet: number;
  continuityPointsPerRound: number;
  continuityMinRounds: number;
  continuityMaxBonus: number;
  continuityMode: string;
}

export default function StreakSettings({
  tournamentId,
  tournamentName,
  onSettingsChanged,
}: ContinuitySettingsProps) {
  const [config, setConfig] = useState<TournamentContinuityConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Cargar configuración actual
  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/tournaments/${tournamentId}/streak-settings`);
      const data = await response.json();

      if (response.ok && data.success) {
        const t = data.tournament;
        setConfig({
          id: t.id,
          title: t.title,
          continuityEnabled: t.continuityEnabled,
          continuityPointsPerSet: t.continuityPointsPerSet,
          continuityPointsPerRound: t.continuityPointsPerRound,
          continuityMinRounds: t.continuityMinRounds,
          continuityMaxBonus: t.continuityMaxBonus,
          continuityMode: t.continuityMode,
        });
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

      // ✅ ACTUALIZADO: Enviar con nombres legacy para compatibilidad con API
      const response = await fetch(`/api/tournaments/${tournamentId}/streak-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streakEnabled: config.continuityEnabled,
          streakPointsPerSetWin: config.continuityPointsPerSet,
          streakPointsPerMatchWin: config.continuityPointsPerRound,
          streakMinSetsForBonus: config.continuityMinRounds,
          streakMaxBonusPerRound: config.continuityMaxBonus,
          streakBonusMode: config.continuityMode,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const t = data.tournament;
        setConfig({
          id: t.id,
          title: t.title,
          continuityEnabled: t.continuityEnabled,
          continuityPointsPerSet: t.continuityPointsPerSet,
          continuityPointsPerRound: t.continuityPointsPerRound,
          continuityMinRounds: t.continuityMinRounds,
          continuityMaxBonus: t.continuityMaxBonus,
          continuityMode: t.continuityMode,
        });
        setSuccess("Configuración de rachas de continuidad guardada correctamente");
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
  const updateConfig = (updates: Partial<TournamentContinuityConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...updates });
  };

  // Validaciones
  const isValidConfig = () => {
    if (!config) return false;
    return (
      config.continuityPointsPerSet >= 0 && config.continuityPointsPerSet <= 5 &&
      config.continuityPointsPerRound >= 0 && config.continuityPointsPerRound <= 10 &&
      config.continuityMinRounds >= 1 && config.continuityMinRounds <= 5 &&
      config.continuityMaxBonus >= 0 && config.continuityMaxBonus <= 20 &&
      ["SETS", "MATCHES", "BOTH"].includes(config.continuityMode)
    );
  };

  // Calcular preview del bonus
  const calculateBonusPreview = () => {
    if (!config || !config.continuityEnabled) return 0;
    
    if (config.continuityMode === "SETS") {
      return config.continuityPointsPerSet * 3; // 3 sets por ronda
    } else if (config.continuityMode === "MATCHES") {
      return config.continuityPointsPerRound;
    } else { // "BOTH"
      return (config.continuityPointsPerSet * 3) + config.continuityPointsPerRound;
    }
  };

  // Cargar al montar
  useEffect(() => {
    loadConfig();
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
          <Zap className="w-5 h-5" />
          Rachas de Continuidad
        </CardTitle>
        <p className="text-sm text-gray-600">{tournamentName}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Habilitar sistema de rachas */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">Sistema de Rachas de Continuidad</span>
              <Badge variant={config.continuityEnabled ? "default" : "secondary"}>
                {config.continuityEnabled ? "Habilitado" : "Deshabilitado"}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">
              Bonus por participar en rondas consecutivas (sin usar comodín)
            </p>
          </div>
          <Switch
            checked={config.continuityEnabled}
            onCheckedChange={(checked) => updateConfig({ continuityEnabled: checked })}
          />
        </div>

        {/* Configuración detallada solo si está habilitado */}
        {config.continuityEnabled && (
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Configuración Básica</TabsTrigger>
              <TabsTrigger value="advanced">Opciones Avanzadas</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              {/* Modo de bonificación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modo de Cálculo del Bonus
                </label>
                <select
                  value={config.continuityMode}
                  onChange={(e) => updateConfig({ continuityMode: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="SETS">Por Sets Jugados (3 sets × puntos)</option>
                  <option value="MATCHES">Por Ronda Completa (puntos fijos)</option>
                  <option value="BOTH">Ambos Combinados</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Define cómo se calculan los puntos bonus por ronda consecutiva
                </p>
              </div>

              {/* Puntos por set */}
              {(config.continuityMode === "SETS" || config.continuityMode === "BOTH") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Puntos por Set en Ronda Consecutiva
                  </label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={config.continuityPointsPerSet}
                      onChange={(e) => updateConfig({ 
                        continuityPointsPerSet: Math.max(0, Math.min(5, parseFloat(e.target.value) || 0))
                      })}
                      className="w-24"
                    />
                    <span className="text-sm text-gray-600">puntos × 3 sets = {(config.continuityPointsPerSet * 3).toFixed(1)} pts por ronda</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Cada ronda tiene 3 sets. Total bonus = puntos × 3 (0-5 pts por set)
                  </p>
                </div>
              )}

              {/* Puntos por ronda */}
              {(config.continuityMode === "MATCHES" || config.continuityMode === "BOTH") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Puntos por Ronda Consecutiva
                  </label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={config.continuityPointsPerRound}
                      onChange={(e) => updateConfig({ 
                        continuityPointsPerRound: Math.max(0, Math.min(10, parseFloat(e.target.value) || 0))
                      })}
                      className="w-24"
                    />
                    <span className="text-sm text-gray-600">puntos fijos por ronda</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Bonus fijo por cada ronda consecutiva participada (0-10 pts)
                  </p>
                </div>
              )}

              {/* Mínimo para bonus */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rondas Mínimas para Activar Bonus
                </label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={config.continuityMinRounds}
                    onChange={(e) => updateConfig({ 
                      continuityMinRounds: Math.max(1, Math.min(5, parseInt(e.target.value) || 1))
                    })}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">rondas consecutivas</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Número mínimo de rondas consecutivas para empezar a recibir bonus (normalmente 2)
                </p>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              {/* Máximo bonus por ronda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Máximo Bonus por Ronda
                </label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="0"
                    max="20"
                    step="0.1"
                    value={config.continuityMaxBonus}
                    onChange={(e) => updateConfig({ 
                      continuityMaxBonus: Math.max(0, Math.min(20, parseFloat(e.target.value) || 0))
                    })}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">puntos máximo</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Límite de puntos bonus que se pueden ganar por rachas en una ronda (0-20)
                </p>
              </div>

              {/* Info sobre reset automático */}
              <div className="p-3 border rounded-lg bg-blue-50">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900">Reset Automático</span>
                </div>
                <p className="text-sm text-blue-700">
                  La racha se resetea automáticamente si el jugador no participa o usa comodín en una ronda.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Previsualización de ejemplo */}
        {config.continuityEnabled && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h5 className="font-medium text-green-900 mb-2 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Ejemplo de Bonus Actual
            </h5>
            <div className="text-sm text-green-700 space-y-1">
              <p>• Ronda 1: Participa → 0 puntos (primera ronda)</p>
              <p>• Ronda 2: Participa → <strong>{calculateBonusPreview()} puntos</strong> ({config.continuityMinRounds} consecutivas)</p>
              <p>• Ronda 3: Participa → <strong>{calculateBonusPreview()} puntos</strong> (3 consecutivas)</p>
              <p>• Ronda 4: Usa comodín → 0 puntos (se rompe la racha)</p>
              <p>• Ronda 5: Participa → 0 puntos (primera después del reset)</p>
              <p>• Máximo bonus por ronda: {config.continuityMaxBonus} puntos</p>
            </div>
          </div>
        )}

        {/* Validaciones y advertencias */}
        {config.continuityEnabled && !isValidConfig() && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Configuración Inválida</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              Revisa que todos los valores estén dentro de los rangos permitidos.
            </p>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button onClick={loadConfig} variant="outline" disabled={loading} className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>

          <Button onClick={saveConfig} disabled={saving || !isValidConfig()} className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
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
          <p>Las rachas premian la participación constante y regular en el torneo.</p>
          <p>Los cambios se aplican al cerrar futuras rondas.</p>
          <p>Usar comodín o no participar resetea la racha automáticamente.</p>
        </div>
      </CardContent>
    </Card>
  );
}