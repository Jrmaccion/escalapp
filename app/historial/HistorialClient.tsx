// app/historial/HistorialClient.tsx - CREAR NUEVO:
"use client";

import { useState, useEffect } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ArrowUp, ArrowDown, Minus, Calendar, AlertTriangle } from "lucide-react";

type HistoryData = {
  hasHistory: boolean;
  message?: string;
  tournament?: {
    id: string;
    title: string;
  };
  rounds: Array<{
    round: number;
    group: number;
    position: number;
    points: number;
    movement: 'up' | 'down' | 'same';
    date: string;
    matches: Array<{
      vs: string;
      result: string;
      points: number;
    }>;
  }>;
  totalStats: {
    totalRounds: number;
    totalPoints: number;
    averagePoints: number;
    bestRound: {
      round: number;
      points: number;
    } | null;
    currentStreak: number;
    bestStreak: number;
  };
};

export default function HistorialClient() {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/player/history');
        if (response.ok) {
          const historyData = await response.json();
          setData(historyData);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getMovementIcon = (movement: 'up' | 'down' | 'same') => {
    switch (movement) {
      case 'up':
        return <ArrowUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <ArrowDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-blue-600" />;
    }
  };

  const getMovementText = (movement: 'up' | 'down' | 'same') => {
    switch (movement) {
      case 'up': return 'Subió';
      case 'down': return 'Bajó';
      default: return 'Se mantuvo';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data?.hasHistory) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <div className="text-center py-20">
          <AlertTriangle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sin historial disponible</h2>
          <p className="text-gray-600">{data?.message || "Aún no tienes historial de rondas completadas."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumbs />
      
      <div className="flex items-center gap-3">
        <History className="w-6 h-6 text-purple-600" />
        <h1 className="text-2xl md:text-3xl font-semibold">Mi Historial</h1>
      </div>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data.totalStats.totalRounds}</div>
              <div className="text-sm text-gray-600">Rondas jugadas</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data.totalStats.averagePoints}</div>
              <div className="text-sm text-gray-600">Media de puntos</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data.totalStats.totalPoints}</div>
              <div className="text-sm text-gray-600">Puntos totales</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data.totalStats.bestRound?.points || 0}</div>
              <div className="text-sm text-gray-600">Mejor ronda</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historial por rondas */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Evolución por Rondas</h2>
        
        {data.rounds.map((roundData) => (
          <Card key={roundData.round}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Ronda {roundData.round}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">
                    {new Date(roundData.date).toLocaleDateString('es-ES')}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {getMovementIcon(roundData.movement)}
                    <span className="text-sm">{getMovementText(roundData.movement)}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600">Grupo</div>
                  <div className="font-bold">Grupo {roundData.group}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Posición Final</div>
                  <div className="font-bold">{roundData.position}º</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Puntos Obtenidos</div>
                  <div className="font-bold">{roundData.points} pts</div>
                </div>
              </div>
              
              {/* Sets de la ronda */}
              {roundData.matches.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Sets jugados:</h4>
                  <div className="space-y-2">
                    {roundData.matches.map((match, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm">
                          <span className="font-medium">vs {match.vs}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="default">
                            {match.result}
                          </Badge>
                          <span className="text-sm font-medium">{match.points} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Información adicional */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-medium text-purple-900 mb-2">Información del Historial</h4>
        <ul className="text-sm text-purple-700 space-y-1">
          <li>• Los movimientos se aplican al final de cada ronda</li>
          <li>• El primer puesto sube de grupo, el último baja</li>
          <li>• Solo se muestran rondas completadas y cerradas</li>
          <li>• Cada partido tiene 3 sets con rotación de jugadores</li>
          <li>• Las estadísticas se actualizan automáticamente</li>
        </ul>
      </div>
    </div>
  );
}