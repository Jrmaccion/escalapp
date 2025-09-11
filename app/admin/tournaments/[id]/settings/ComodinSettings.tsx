"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface ComodinSettingsProps {
  tournamentId: string;
  currentSettings: {
    maxComodinesPerPlayer: number;
    enableMeanComodin: boolean;
    enableSubstituteComodin: boolean;
    substituteCreditFactor: number;
    substituteMaxAppearances: number;
  };
}

export default function ComodinSettings({ tournamentId, currentSettings }: ComodinSettingsProps) {
  const [settings, setSettings] = useState(currentSettings);
  const [isLoading, setIsLoading] = useState(false);

  const updateSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/comodin-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        alert('Configuración actualizada correctamente');
      } else {
        alert('Error al actualizar configuración');
      }
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Comodines</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Límite de comodines por jugador */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Comodines por jugador por torneo
          </label>
          <Input
            type="number"
            min="0"
            max="10"
            value={settings.maxComodinesPerPlayer}
            onChange={(e) => setSettings({
              ...settings,
              maxComodinesPerPlayer: parseInt(e.target.value) || 1
            })}
          />
          <p className="text-xs text-gray-600 mt-1">
            Número máximo de comodines que cada jugador puede usar en este torneo
          </p>
        </div>

        {/* Habilitar tipos de comodines */}
        <div className="space-y-4">
          <h4 className="font-medium">Tipos de comodines habilitados</h4>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Comodín de Media</div>
              <div className="text-sm text-gray-600">Aplica puntuación promedio</div>
            </div>
            <Switch
              checked={settings.enableMeanComodin}
              onCheckedChange={(checked) => setSettings({
                ...settings,
                enableMeanComodin: checked
              })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Comodín de Sustituto</div>
              <div className="text-sm text-gray-600">Otro jugador juega por ti</div>
            </div>
            <Switch
              checked={settings.enableSubstituteComodin}
              onCheckedChange={(checked) => setSettings({
                ...settings,
                enableSubstituteComodin: checked
              })}
            />
          </div>
        </div>

        {/* Configuración de sustitutos */}
        {settings.enableSubstituteComodin && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h5 className="font-medium">Configuración de sustitutos</h5>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Factor de crédito Ironman (0.0 - 1.0)
              </label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={settings.substituteCreditFactor}
                onChange={(e) => setSettings({
                  ...settings,
                  substituteCreditFactor: parseFloat(e.target.value) || 0.5
                })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Máximo de apariciones como sustituto
              </label>
              <Input
                type="number"
                min="1"
                max="10"
                value={settings.substituteMaxAppearances}
                onChange={(e) => setSettings({
                  ...settings,
                  substituteMaxAppearances: parseInt(e.target.value) || 2
                })}
              />
            </div>
          </div>
        )}

        <Button onClick={updateSettings} disabled={isLoading} className="w-full">
          {isLoading ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </CardContent>
    </Card>
  );
}