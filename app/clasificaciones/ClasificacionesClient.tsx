// app/clasificaciones/ClasificacionesClient.tsx - CREAR NUEVO:
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Target, Users, TrendingUp, AlertTriangle } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";

type RankingsData = {
  hasActiveTournament: boolean;
  hasRankings?: boolean;
  message?: string;
  tournament?: {
    id: string;
    title: string;
  };
  currentUser?: {
    position: number;
    averagePoints: number;
    totalPoints: number;
    roundsPlayed: number;
    ironmanPosition: number;
  };
  official: Array<{
    id: string;
    name: string;
    position: number;
    averagePoints: number;
    totalPoints: number;
    roundsPlayed: number;
    isCurrentUser: boolean;
  }>;
  ironman: Array<{
    id: string;
    name: string;
    position: number;
    totalPoints: number;
    averagePoints: number;
    roundsPlayed: number;
    isCurrentUser: boolean;
  }>;
};

export default function ClasificacionesClient() {
  const [data, setData] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/rankings');
        if (response.ok) {
          const rankingsData = await response.json();
          setData(rankingsData);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data?.hasActiveTournament || !data?.hasRankings) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <div className="text-center py-20">
          <AlertTriangle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {!data?.hasActiveTournament ? "No hay torneo activo" : "Sin rankings disponibles"}
          </h2>
          <p className="text-gray-600">{data?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
      <Breadcrumbs />
      
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 text-yellow-600" />
        <h1 className="text-2xl md:text-3xl font-semibold">Clasificaciones</h1>
      </div>

      {data.currentUser && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600">Posición Oficial</span>
              </div>
              <div className="text-2xl font-bold">#{data.currentUser.position}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-gray-600">Media</span>
              </div>
              <div className="text-2xl font-bold">{data.currentUser.averagePoints.toFixed(1)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">Total Puntos</span>
              </div>
              <div className="text-2xl font-bold">{data.currentUser.totalPoints.toFixed(1)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-600">Rondas</span>
              </div>
              <div className="text-2xl font-bold">{data.currentUser.roundsPlayed}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="official" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="official">Ranking Oficial</TabsTrigger>
          <TabsTrigger value="ironman">Ranking Ironman</TabsTrigger>
        </TabsList>

        <TabsContent value="official" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Ranking Oficial
              </CardTitle>
              <p className="text-sm text-gray-600">
                Por media de puntos por ronda jugada. Determina el campeón del torneo.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.official.map((player, index) => (
                  <div 
                    key={player.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      player.isCurrentUser 
                        ? 'bg-blue-50 border-blue-200' 
                        : index < 3 
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                        index === 0 ? 'bg-yellow-200' :
                        index === 1 ? 'bg-gray-200' :
                        index === 2 ? 'bg-orange-200' :
                        'bg-gray-100'
                      }`}>
                        {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${player.position}`}
                      </div>
                      <div>
                        <div className="font-bold text-lg">
                          {player.name}
                          {player.isCurrentUser && (
                            <Badge variant="outline" className="ml-2 text-xs">Tú</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {player.averagePoints.toFixed(2)} pts/ronda • {player.roundsPlayed} rondas
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">#{player.position}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ironman" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Ranking Ironman
              </CardTitle>
              <p className="text-sm text-gray-600">
                Por puntos totales acumulados. Premia la participación constante.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.ironman.map((player, index) => (
                  <div 
                    key={player.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      player.isCurrentUser 
                        ? 'bg-blue-50 border-blue-200' 
                        : index < 3 
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-200 text-yellow-800' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-200 text-orange-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        #{player.position}
                      </div>
                      <div>
                        <div className="font-bold text-lg">
                          {player.name}
                          {player.isCurrentUser && (
                            <Badge variant="outline" className="ml-2 text-xs">Tú</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {player.totalPoints.toFixed(1)} pts totales • {player.roundsPlayed} rondas
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{player.totalPoints.toFixed(1)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Información sobre los rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Ranking Oficial</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-blue-700 space-y-2">
              <li>• Media de puntos por ronda jugada</li>
              <li>• Elegible a Campeón si juega ≥50% de rondas</li>
              <li>• Refleja la consistencia y calidad del juego</li>
              <li>• Usado para determinar el ganador del torneo</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-900">Ranking Ironman</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-green-700 space-y-2">
              <li>• Puntos totales acumulados en el torneo</li>
              <li>• Premia la participación constante</li>
              <li>• Reconoce el esfuerzo y la dedicación</li>
              <li>• Premio especial para el líder Ironman</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}