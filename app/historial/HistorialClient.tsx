// app/historial/HistorialClient.tsx - CON ICONOS PARA GRUPOS SKIPPED
"use client";

import { useState, useEffect } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  History, 
  ArrowUp, 
  ArrowDown, 
  Minus, 
  Calendar, 
  AlertTriangle, 
  TrendingUp, 
  Trophy,
  Medal,
  Award,
  Circle,
  Star,
  XCircle,
  PauseCircle
} from "lucide-react";

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
    movementText: string;
    date: string;
    wasSkipped?: boolean;
    skippedReason?: string;
    technicalPoints?: boolean;
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

  const getMovementInfo = (position: number, movement: 'up' | 'down' | 'same', wasSkipped?: boolean) => {
    if (wasSkipped) {
      return {
        icon: <XCircle className="w-4 h-4 text-red-600" />,
        text: "Grupo no disputado",
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200"
      };
    }

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

  const getPositionInfo = (position: number, wasSkipped?: boolean) => {
    if (wasSkipped) {
      return {
        icon: <PauseCircle className="w-4 h-4 text-gray-600" />,
        class: "bg-gray-100 text-gray-700 border-gray-300",
        text: "Grupo no disputado - Puntos técnicos",
        number: "⏸️"
      };
    }

    switch (position) {
      case 1:
        return {
          icon: <Trophy className="w-4 h-4 text-yellow-600" />,
          class: "bg-yellow-100 text-yellow-800 border-yellow-300",
          text: "1º - ¡Campeón del grupo!",
          number: "1º"
        };
      case 2:
        return {
          icon: <Medal className="w-4 h-4 text-gray-600" />,
          class: "bg-gray-100 text-gray-700 border-gray-300",
          text: "2º - Subcampeón",
          number: "2º"
        };
      case 3:
        return {
          icon: <Award className="w-4 h-4 text-orange-600" />,
          class: "bg-orange-100 text-orange-700 border-orange-300", 
          text: "3º - Tercer lugar",
          number: "3º"
        };
      case 4:
        return {
          icon: <Circle className="w-4 h-4 text-red-600" />,
          class: "bg-red-100 text-red-700 border-red-300",
          text: "4º - Cuarto lugar",
          number: "4º"
        };
      default:
        return {
          icon: <Circle className="w-4 h-4 text-blue-600" />,
          class: "bg-blue-100 text-blue-700 border-blue-300",
          text: `${position}º lugar`,
          number: `${position}º`
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
        
        <div className="text-center py-12">
          <History className="h-16 w-16 text-gray-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Tu historial se está construyendo</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            {data?.message || "Una vez que participes en rondas completadas, aquí verás tu evolución y progreso en el torneo."}
          </p>

          {/* Preview simplificado */}
          <div className="max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Así se verá tu historial:</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xl font-bold text-blue-600">5</div>
                <div className="text-sm text-blue-700">Rondas jugadas</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-xl font-bold text-green-600">7.8</div>
                <div className="text-sm text-green-700">Media de puntos</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-xl font-bold text-purple-600">39.0</div>
                <div className="text-sm text-purple-700">Puntos totales</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="text-xl font-bold text-orange-600">9.5</div>
                <div className="text-sm text-orange-700">Mejor ronda</div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Ronda 3 (Ejemplo)
                </h4>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">15 Mar 2025</Badge>
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded-full">
                    <ArrowUp className="w-3 h-3 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">Subió 1 grupo</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Grupo</div>
                  <div className="font-semibold">Grupo 2</div>
                </div>
                <div>
                  <div className="text-gray-600">Posición Final</div>
                  <div className="flex items-center gap-1">
                    <span className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-medium flex items-center gap-1">
                      <Medal className="w-3 h-3 text-gray-600" />
                      2º lugar
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">Puntos Obtenidos</div>
                  <div className="font-semibold text-green-600">8.0 pts</div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Sistema de Escalera
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-700">
                <div className="flex items-center gap-2">
                  <ArrowUp className="w-4 h-4 text-green-600" />
                  <span><strong>1º-2º lugar:</strong> Subes de grupo</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowDown className="w-4 h-4 text-red-600" />
                  <span><strong>3º-4º lugar:</strong> Bajas de grupo</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-gray-600" />
                  <span><strong>No disputado:</strong> Puntos técnicos</span>
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Tu progreso se registra automáticamente al finalizar cada ronda
              </p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-sm text-gray-500">
              ¡Participa en tu primera ronda para empezar a ver tu evolución!
            </p>
          </div>
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

      {/* Información del sistema actualizado */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Sistema de Escalera
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-blue-700">
            <div className="flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-green-600" />
              <span><strong>1º:</strong> Sube 2 grupos</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-green-600" />
              <span><strong>2º:</strong> Sube 1 grupo</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-red-600" />
              <span><strong>3º:</strong> Baja 1 grupo</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-red-600" />
              <span><strong>4º:</strong> Baja 2 grupos</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-blue-600">
            <XCircle className="w-3 h-3 inline mr-1" />
            Los grupos no disputados reciben puntos técnicos y penalización de -1 grupo
          </div>
        </CardContent>
      </Card>

      {/* Historial por rondas */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Evolución por Rondas</h2>
        
        {data.rounds.map((roundData) => {
          const movementInfo = getMovementInfo(roundData.position, roundData.movement, roundData.wasSkipped);
          const positionInfo = getPositionInfo(roundData.position, roundData.wasSkipped);
          
          return (
            <Card key={roundData.round} className={`hover:shadow-md transition-shadow ${roundData.wasSkipped ? 'border-red-200' : ''}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Ronda {roundData.round}
                    {roundData.wasSkipped && (
                      <Badge className="bg-red-100 text-red-700 ml-2">
                        <XCircle className="w-3 h-3 mr-1" />
                        No Disputado
                      </Badge>
                    )}
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
                {/* Alert si fue SKIPPED */}
                {roundData.wasSkipped && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                      <div className="text-sm text-red-700">
                        <div className="font-semibold mb-1">Grupo No Disputado</div>
                        <p>Este grupo no completó los 3 sets requeridos.</p>
                        {roundData.skippedReason && (
                          <p className="text-xs mt-1">Razón: {roundData.skippedReason}</p>
                        )}
                        {roundData.technicalPoints && (
                          <p className="text-xs mt-1">
                            Se aplicaron puntos técnicos (50% de la media)
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-600">Grupo</div>
                    <div className="font-bold">Grupo {roundData.group}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">
                      {roundData.wasSkipped ? 'Estado Final' : 'Posición Final'}
                    </div>
                    <div className="flex items-center gap-2 font-bold">
                      <span className={`px-2 py-1 rounded border text-sm flex items-center gap-1 ${positionInfo.class}`}>
                        {positionInfo.icon}
                        {positionInfo.number}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {positionInfo.text}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Puntos Obtenidos</div>
                    <div className="font-bold text-lg flex items-center gap-2">
                      {roundData.points.toFixed(1)} pts
                      {roundData.technicalPoints && (
                        <Badge className="bg-orange-100 text-orange-700 text-xs">
                          Técnicos
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Sets de la ronda (solo si NO fue SKIPPED) */}
                {!roundData.wasSkipped && roundData.matches.length > 0 && (
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

                {/* Explicación del movimiento */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Trophy className="w-4 h-4 text-blue-500 mt-0.5" />
                    <div className="text-sm text-gray-700">
                      <strong>Resultado:</strong>{" "}
                      {roundData.wasSkipped ? (
                        <>
                          Tu grupo no completó los sets requeridos. Recibiste puntos técnicos (50% de la media) 
                          y bajaste 1 grupo como penalización.
                        </>
                      ) : (
                        <>
                          Terminaste en {roundData.position}º lugar del grupo {roundData.group}.{" "}
                          {roundData.position === 1 && "¡Excelente! Como campeón del grupo, subiste 2 grupos para la siguiente ronda."}
                          {roundData.position === 2 && "¡Bien jugado! Como subcampeón, subiste 1 grupo para la siguiente ronda."}
                          {roundData.position === 3 && "Bajaste 1 grupo para la siguiente ronda. ¡A por la revancha!"}
                          {roundData.position === 4 && "Bajaste 2 grupos para la siguiente ronda. ¡Oportunidad de mejora!"}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Información adicional */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-medium text-purple-900 mb-2">Información del Sistema</h4>
        <ul className="text-sm text-purple-700 space-y-1">
          <li>• <strong>1º lugar:</strong> Sube 2 grupos (máximo progreso)</li>
          <li>• <strong>2º lugar:</strong> Sube 1 grupo (buen rendimiento)</li>
          <li>• <strong>3º lugar:</strong> Baja 1 grupo (oportunidad de mejora)</li>
          <li>• <strong>4º lugar:</strong> Baja 2 grupos (necesita más práctica)</li>
          <li>• <strong>Grupo no disputado:</strong> Puntos técnicos (50%) + penalización -1 grupo</li>
          <li>• Solo se muestran rondas completadas y cerradas</li>
          <li>• Cada ronda tiene 3 sets con rotación de parejas</li>
        </ul>
      </div>
    </div>
  );
}