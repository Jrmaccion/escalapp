"use client";

import { ArrowLeft, Calendar, Users, Trophy, CheckCircle, Clock, Play, X } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useTransition } from "react";

type SerializedRound = {
  id: string;
  number: number;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  tournament: {
    id: string;
    title: string;
  };
};

type SerializedPlayer = {
  id: string;
  name: string;
  position: number;
  points: number;
  streak: number;
  usedComodin: boolean;
};

type SerializedMatch = {
  id: string;
  setNumber: number;
  team1Player1Id: string;
  team1Player2Id: string;
  team2Player1Id: string;
  team2Player2Id: string;
  team1Games: number | null;
  team2Games: number | null;
  tiebreakScore: string | null;
  isConfirmed: boolean;
  photoUrl: string | null;
};

type SerializedGroup = {
  id: string;
  number: number;
  level: number;
  players: SerializedPlayer[];
  matches: SerializedMatch[];
};

type Stats = {
  totalGroups: number;
  totalMatches: number;
  confirmedMatches: number;
  pendingMatches: number;
  completionPercentage: number;
};

type RoundDetailClientProps = {
  round: SerializedRound;
  groups: SerializedGroup[];
  stats: Stats;
};

export default function RoundDetailClient({ round, groups, stats }: RoundDetailClientProps) {
  const [isPending, startTransition] = useTransition();

  const closeRound = () => {
    const confirmed = confirm("¿Cerrar esta ronda y aplicar movimientos?");
    if (!confirmed) return;
    
    startTransition(async () => {
      try {
        const res = await fetch(`/api/rounds/${round.id}/close`, { method: "POST" });
        if (res.ok) {
          window.location.reload();
        } else {
          const errorText = await res.text();
          console.error("Error cerrando ronda:", errorText);
          alert(`No se pudo cerrar la ronda: ${errorText}`);
        }
      } catch (error) {
        console.error("Error de conexión:", error);
        alert("Error de conexión");
      }
    });
  };

  const generateNextRound = () => {
    const confirmed = confirm("¿Generar la siguiente ronda a partir de esta?");
    if (!confirmed) return;
    
    startTransition(async () => {
      try {
        const res = await fetch(`/api/rounds/${round.id}/generate-next`, { method: "POST" });
        if (res.ok) {
          window.location.reload();
        } else {
          const errorText = await res.text();
          console.error("Error generando ronda:", errorText);
          alert(`No se pudo generar la siguiente ronda: ${errorText}`);
        }
      } catch (error) {
        console.error("Error de conexión:", error);
        alert("Error de conexión");
      }
    });
  };

  const getPlayerName = (playerId: string): string => {
    for (const group of groups) {
      const player = group.players.find(p => p.id === playerId);
      if (player) return player.name;
    }
    return "Jugador desconocido";
  };

  const formatMatchScore = (match: SerializedMatch): string => {
    if (match.team1Games === null || match.team2Games === null) {
      return "Sin resultado";
    }
    const baseScore = `${match.team1Games}-${match.team2Games}`;
    if (match.tiebreakScore) {
      return `${baseScore} (TB ${match.tiebreakScore})`;
    }
    return baseScore;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header con navegación */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/admin/rounds" className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Rondas
            </Link>
            <Link href="/admin" className="inline-flex items-center px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
              Dashboard Admin
            </Link>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Ronda {round.number}</h1>
              <p className="text-gray-600">{round.tournament.title}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span>Inicio: {format(new Date(round.startDate), "d MMM yyyy", { locale: es })}</span>
                <span>Fin: {format(new Date(round.endDate), "d MMM yyyy", { locale: es })}</span>
              </div>
            </div>
            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                round.isClosed 
                  ? 'bg-gray-100 text-gray-700' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {round.isClosed ? "Ronda Cerrada" : "Ronda Activa"}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Grupos</h3>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold">{stats.totalGroups}</div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Partidos</h3>
              <Play className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold">{stats.totalMatches}</div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Confirmados</h3>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold">{stats.confirmedMatches}</div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Pendientes</h3>
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
            <div className="text-2xl font-bold">{stats.pendingMatches}</div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Progreso</h3>
              <Trophy className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold">{stats.completionPercentage}%</div>
          </div>
        </div>

        {/* Grupos */}
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.id} className="bg-white rounded-lg shadow border">
              <div className="bg-gray-50 px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">
                  Grupo {group.number} - Nivel {group.level}
                </h2>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Jugadores del grupo */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Jugadores</h3>
                    <div className="space-y-2">
                      {group.players
                        .sort((a, b) => a.position - b.position)
                        .map((player) => (
                        <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">
                              {player.position}
                            </div>
                            <span className="font-medium">{player.name}</span>
                            {player.usedComodin && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                Comodín
                              </span>
                            )}
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-bold">{player.points.toFixed(1)} pts</div>
                            <div className="text-gray-500">Racha: {player.streak}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Partidos del grupo */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Partidos</h3>
                    <div className="space-y-2">
                      {group.matches.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          No hay partidos programados
                        </div>
                      ) : (
                        group.matches.map((match) => (
                          <div key={match.id} className={`p-3 rounded border ${
                            match.isConfirmed ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-medium">Set {match.setNumber}</div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {getPlayerName(match.team1Player1Id)} + {getPlayerName(match.team1Player2Id)}
                                  <br />
                                  vs
                                  <br />
                                  {getPlayerName(match.team2Player1Id)} + {getPlayerName(match.team2Player2Id)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold">{formatMatchScore(match)}</div>
                                <div className="flex items-center gap-1 mt-1">
                                  {match.isConfirmed ? (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Clock className="h-4 w-4 text-yellow-600" />
                                  )}
                                  <span className={`text-xs ${
                                    match.isConfirmed ? 'text-green-600' : 'text-yellow-600'
                                  }`}>
                                    {match.isConfirmed ? 'Confirmado' : 'Pendiente'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Acciones rápidas */}
        <div className="mt-8 flex justify-center gap-4">
          <Link 
            href="/admin/results"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Validar Resultados Pendientes
          </Link>
          
          {!round.isClosed && (
            <button 
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              onClick={closeRound}
              disabled={isPending}
            >
              <X className="w-4 h-4 mr-2" />
              {isPending ? 'Cerrando...' : 'Cerrar Ronda'}
            </button>
          )}

          {round.isClosed && (
            <button 
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              onClick={generateNextRound}
              disabled={isPending}
            >
              <Play className="w-4 h-4 mr-2" />
              {isPending ? 'Generando...' : 'Generar Siguiente'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}