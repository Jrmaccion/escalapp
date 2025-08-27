"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Minus, Crown, Medal, Award } from "lucide-react";
import Link from "next/link";

type RankingPlayer = {
  playerId: string;
  playerName: string;
  position: number;
  totalPoints: number;
  roundsPlayed: number;
  averagePoints: number;
  ironmanPosition: number;
  movement: "up" | "down" | "stable" | "new";
};

type Tournament = {
  id: string;
  title: string;
  currentRound: number;
  totalRounds: number;
};

type RankingsClientProps = {
  rankings: RankingPlayer[];
  tournament: Tournament;
};

export default function RankingsClient({ rankings, tournament }: RankingsClientProps) {
  const getPositionIcon = (position: number) => {
    if (position === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (position === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (position === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return null;
  };

  const getMovementIcon = (movement: string) => {
    switch (movement) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case "new":
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Nuevo</Badge>;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getPositionStyle = (position: number) => {
    if (position === 1) return "bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200";
    if (position === 2) return "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200";
    if (position === 3) return "bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200";
    if (position <= 5) return "bg-green-50 border-green-200";
    return "bg-white border-gray-200";
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header con navegación */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" asChild>
              <Link href="/admin">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard Admin
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Rankings</h1>
          <p className="text-gray-600">
            {tournament.title} • Ronda {tournament.currentRound} de {tournament.totalRounds}
          </p>
        </div>

        {/* Podio */}
        {rankings.length >= 3 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-600" />
                Podio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center items-end gap-6">
                {/* Segundo lugar */}
                {rankings[1] && (
                  <div className="text-center">
                    <div className="w-20 h-16 bg-gradient-to-t from-gray-300 to-gray-200 rounded-t flex items-end justify-center mb-2">
                      <Medal className="h-8 w-8 text-gray-500 mb-2" />
                    </div>
                    <div className="font-bold">{rankings[1].playerName}</div>
                    <div className="text-sm text-gray-600">{rankings[1].totalPoints.toFixed(1)} pts</div>
                    <Badge variant="secondary">2°</Badge>
                  </div>
                )}

                {/* Primer lugar */}
                {rankings[0] && (
                  <div className="text-center">
                    <div className="w-24 h-20 bg-gradient-to-t from-yellow-400 to-yellow-300 rounded-t flex items-end justify-center mb-2">
                      <Crown className="h-10 w-10 text-yellow-700 mb-2" />
                    </div>
                    <div className="font-bold text-lg">{rankings[0].playerName}</div>
                    <div className="text-sm text-gray-600">{rankings[0].totalPoints.toFixed(1)} pts</div>
                    <Badge className="bg-yellow-600">1°</Badge>
                  </div>
                )}

                {/* Tercer lugar */}
                {rankings[2] && (
                  <div className="text-center">
                    <div className="w-20 h-14 bg-gradient-to-t from-amber-400 to-amber-300 rounded-t flex items-end justify-center mb-2">
                      <Award className="h-7 w-7 text-amber-700 mb-2" />
                    </div>
                    <div className="font-bold">{rankings[2].playerName}</div>
                    <div className="text-sm text-gray-600">{rankings[2].totalPoints.toFixed(1)} pts</div>
                    <Badge variant="outline" className="border-amber-600 text-amber-600">3°</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ranking completo */}
        <Card>
          <CardHeader>
            <CardTitle>Clasificación General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rankings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay datos de ranking disponibles aún.</p>
                  <p className="text-sm mt-2">Los rankings se generan después de completar algunos partidos.</p>
                </div>
              ) : (
                rankings.map((player) => (
                  <div
                    key={player.playerId}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${getPositionStyle(player.position)}`}
                  >
                    {/* Posición */}
                    <div className="flex items-center gap-2 min-w-[60px]">
                      {getPositionIcon(player.position)}
                      <span className="font-bold text-lg">#{player.position}</span>
                    </div>

                    {/* Movimiento */}
                    <div className="min-w-[80px] flex justify-center">
                      {getMovementIcon(player.movement)}
                    </div>

                    {/* Nombre del jugador */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{player.playerName}</h3>
                    </div>

                    {/* Estadísticas */}
                    <div className="grid grid-cols-3 gap-4 text-center min-w-[300px]">
                      <div>
                        <div className="text-sm text-gray-500">Puntos</div>
                        <div className="font-bold text-lg">{player.totalPoints.toFixed(1)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Rondas</div>
                        <div className="font-bold">{player.roundsPlayed}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Promedio</div>
                        <div className="font-bold">{player.averagePoints.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Posición Ironman */}
                    <div className="min-w-[100px] text-center">
                      <div className="text-sm text-gray-500">Ironman</div>
                      <Badge variant="outline">#{player.ironmanPosition}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Información adicional */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>El ranking se actualiza automáticamente después de cada ronda.</p>
          <p className="mt-1">
            <strong>Ironman:</strong> Clasificación basada en constancia y participación.
          </p>
        </div>
      </div>
    </div>
  );
}