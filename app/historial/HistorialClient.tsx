// app/historial/HistorialClient.tsx - ACTUALIZADO CON NUEVO SISTEMA DE MOVIMIENTOS
"use client";

import { useState, useEffect } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ArrowUp, ArrowDown, Minus, Calendar, AlertTriangle, TrendingUp, Trophy } from "lucide-react";

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
    movementText: string; // Nuevo campo para texto específico del movimiento
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
        const response = await fetch('/api/player/historial');
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

  // NUEVA FUNCIÓN: Iconos y textos para el nuevo sistema de movimientos
  const getMovementInfo = (position: number, movement: 'up' | 'down' | 'same') => {
    // Si hay texto personalizado del servidor, úsalo. Si no, calcula basado en posición
    switch (position) {
      case 1:
        return {
          icon: <ArrowUp className="w-4 h-4 text-green-600" />,
          text: "Subió 2 grupos",
          color: "text-green-600",
          bgColor: "bg-green-50 border-green-200"
        };
      case 2:
        return {
          icon: <ArrowUp className="w-4 h-4 text-green-600" />,
          text: "Subió 1 grupo", 
          color: "text-green-600",
          bgColor: "bg-green-50 border-green-200"
        };
      case 3:
        return {
          icon: <ArrowDown className="w-4 h-4 text-red-600" />,
          text: "Bajó 1 grupo",
          color: "text-red-600", 
          bgColor: "bg-red-50 border-red-200"
        };
      case 4:
        return {
          icon: <ArrowDown className="w-4 h-4 text-red-600" />,
          text: "Bajó 2 grupos",
          color: "text-red-600",
          bgColor: "bg-red-50 border-red-200"
        };
      default:
        // Fallback para posiciones imprevistas
        switch (movement) {
          case 'up':
            return {
              icon: <ArrowUp className="w-4 h-4 text-green-600" />,
              text: "Subió de grupo",
              color: "text-green-600",
              bgColor: "bg-green-50 border-green-200"
            };
          case 'down':
            return {
              icon: <ArrowDown className="w-4 h-4 text-red-600" />,
              text: "Bajó de grupo", 
              color: "text-red-600",
              bgColor: "bg-red-50 border-red-200"
            };
          default:
            return {
              icon: <Minus className="w-4 h-4 text-blue-600" />,
              text: "Se mantuvo",
              color: "text-blue-600",
              bgColor: "bg-blue-50 border-blue-200"
            };
        }
    }
  };

  const getPositionBadge = (position: number) => {
    switch (position) {
      case 1:
        return {
          emoji: "🥇",
          class: "bg-yellow-100 text-yellow-800 border-yellow-300",
          text: "1º - ¡Campeón del grupo!"
        };
      case 2:
        return {
          emoji: "🥈", 
          class: "bg-gray-100 text-gray-700 border-gray-300",
          text: "2º - Subcampeón"
        };
      case 3:
        return {
          emoji: "🥉",
          class: "bg-orange-100 text-orange-700 border-orange-300", 
          text: "3º - Tercer lugar"
        };
      case 4:
        return {
          emoji: "4️⃣",
          class: "bg-red-100 text-red-700 border-red-300",
          text: "4º - Cuarto lugar"
        };
      default:
        return {
          emoji: `${position}º`,
          class: "bg-blue-100 text-blue-700 border-blue-300",
          text: `${position}º lugar`
        };
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

      <p className="text-gray-600">
        {data.tournament?.title} - Evolución completa de tu participación
      </p>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{data.totalStats.totalRounds}</div>
              <div className="text-sm text-gray-600">Rondas jugadas</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data.totalStats.averagePoints.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Media de puntos</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{data.totalStats.totalPoints.toFixed(1)}</div>
              <div className="text-sm text-gray-600">Puntos totales</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{data.totalStats.bestRound?.points.toFixed(1) || 0}</div>
              <div className="text-sm text-gray-600">Mejor ronda</div>
              {data.totalStats.bestRound && (
                <div className="text-xs text-gray-500">R{data.totalStats.bestRound.round}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Información del sistema de escalera actualizado */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Sistema de Escalera Actualizado
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-blue-700">
            <div className="flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-green-600" />
              <span><strong>1º lugar:</strong> Sube 2 grupos</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-green-600" />
              <span><strong>2º lugar:</strong> Sube 1 grupo</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-red-600" />
              <span><strong>3º lugar:</strong> Baja 1 grupo</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-red-600" />
              <span><strong>4º lugar:</strong> Baja 2 grupos</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historial por rondas */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Evolución por Rondas</h2>
        
        {data.rounds.map((roundData) => {
          const movementInfo = getMovementInfo(roundData.position, roundData.movement);
          const positionBadge = getPositionBadge(roundData.position);
          
          return (
            <Card key={roundData.round} className="hover:shadow-md transition-shadow">
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
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${movementInfo.bgColor}`}>
                      {movementInfo.icon}
                      <span className={`text-sm font-medium ${movementInfo.color}`}>
                        {roundData.movementText || movementInfo.text}
                      </span>
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
                    <div className={`flex items-center gap-2 font-bold`}>
                      <span className={`px-2 py-1 rounded border text-sm ${positionBadge.class}`}>
                        {positionBadge.emoji} {roundData.position}º
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {positionBadge.text}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Puntos Obtenidos</div>
                    <div className="font-bold text-lg">{roundData.points.toFixed(1)} pts</div>
                  </div>
                </div>
                
                {/* Sets de la ronda */}
                {roundData.matches.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Sets jugados en esta ronda:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {roundData.matches.map((match, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm">
                            <span className="font-medium">vs {match.vs}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="text-xs">
                              {match.result}
                            </Badge>
                            <span className="text-sm font-medium">{match.points} pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Explicación del movimiento específico */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Trophy className="w-4 h-4 text-blue-500 mt-0.5" />
                    <div className="text-sm text-gray-700">
                      <strong>Resultado:</strong> Terminaste en {roundData.position}º lugar del grupo {roundData.group}.{" "}
                      {roundData.position === 1 && "¡Excelente! Como campeón del grupo, subiste 2 grupos para la siguiente ronda."}
                      {roundData.position === 2 && "¡Bien jugado! Como subcampeón, subiste 1 grupo para la siguiente ronda."}
                      {roundData.position === 3 && "Bajaste 1 grupo para la siguiente ronda. ¡A por la revancha!"}
                      {roundData.position === 4 && "Bajaste 2 grupos para la siguiente ronda. ¡Oportunidad de mejora!"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Información adicional actualizada */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-medium text-purple-900 mb-2">Información del Sistema de Escalera</h4>
        <ul className="text-sm text-purple-700 space-y-1">
          <li>• <strong>1º lugar:</strong> Sube 2 grupos (máximo progreso)</li>
          <li>• <strong>2º lugar:</strong> Sube 1 grupo (buen rendimiento)</li>
          <li>• <strong>3º lugar:</strong> Baja 1 grupo (oportunidad de mejora)</li>
          <li>• <strong>4º lugar:</strong> Baja 2 grupos (necesita más práctica)</li>
          <li>• Solo se muestran rondas completadas y cerradas</li>
          <li>• Cada ronda tiene 3 sets con rotación de parejas</li>
          <li>• Las estadísticas se actualizan automáticamente</li>
        </ul>
      </div>
    </div>
  );
}