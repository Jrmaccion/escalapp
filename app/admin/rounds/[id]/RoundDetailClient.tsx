"use client";

import { ArrowLeft, Users, Trophy, CheckCircle, Clock, Play, X, ListChecks, Info } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState, useTransition } from "react";

type SerializedRound = {
  id: string;
  number: number;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  tournament: { id: string; title: string };
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

type EligiblePlayer = { playerId: string; name: string; email?: string; joinedRound?: number };

export default function RoundDetailClient({ round, groups, stats }: RoundDetailClientProps) {
  const [isPending, startTransition] = useTransition();
  const [eligibleOpen, setEligibleOpen] = useState(false);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [eligibleError, setEligibleError] = useState<string | null>(null);
  const [eligiblePlayers, setEligiblePlayers] = useState<EligiblePlayer[]>([]);

  async function loadEligiblePlayers() {
    setEligibleError(null);
    setEligibleLoading(true);
    try {
      const res = await fetch(`/api/rounds/${round.id}/eligible-players`, { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Error cargando jugadores elegibles");
      }
      const json = await res.json();
      setEligiblePlayers(Array.isArray(json.players) ? json.players : []);
    } catch (e: any) {
      setEligibleError(e?.message || "Error cargando jugadores elegibles");
    } finally {
      setEligibleLoading(false);
    }
  }

  useEffect(() => {
    if (eligibleOpen) loadEligiblePlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleOpen]);

  const closeRound = () => {
    const confirmed = confirm("¿Cerrar esta ronda y aplicar movimientos?");
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/rounds/${round.id}/close`, { method: "POST" });
        if (res.ok) {
          // Opcional: podrías leer el summary devuelto
          window.location.reload();
        } else {
          const errorText = await res.text();
          console.error("Error cerrando ronda:", errorText);
          alert(`No se pudo cerrar la ronda:\n${errorText}`);
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
          alert(`No se pudo generar la siguiente ronda:\n${errorText}`);
        }
      } catch (error) {
        console.error("Error de conexión:", error);
        alert("Error de conexión");
      }
    });
  };

  const getPlayerName = (playerId: string): string => {
    for (const group of groups) {
      const player = group.players.find((p) => p.id === playerId);
      if (player) return player.name;
    }
    return "Jugador desconocido";
  };

  const formatMatchScore = (match: SerializedMatch): string => {
    if (match.team1Games === null || match.team2Games === null) return "Sin resultado";
    const base = `${match.team1Games}-${match.team2Games}`;
    return match.tiebreakScore ? `${base} (TB ${match.tiebreakScore})` : base;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header con navegación */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/admin/rounds"
              className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Rondas
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
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
              <span
                className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                  round.isClosed ? "bg-gray-100 text-gray-700" : "bg-green-100 text-green-700"
                }`}
              >
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

        {/* Aviso reglas de grupo */}
        <div className="mb-6 flex items-start gap-2 text-sm text-gray-700">
          <Info className="w-4 h-4 mt-0.5 text-blue-600" />
          <p>
            Los grupos se generan en bloques de <strong>4 jugadores</strong>. Si hay sobrantes, no se crean grupos incompletos.
            Al cerrar la ronda se aplican movimientos: <strong>1º sube</strong>, <strong>4º baja</strong>, <strong>2º y 3º mantienen</strong>.
          </p>
        </div>

        {/* Grupos */}
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.id} className="bg-white rounded-lg shadow border">
              <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Grupo {group.number} · Nivel {group.level}
                </h2>
                <button
                  className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                  onClick={() => setEligibleOpen(true)}
                  title="Ver jugadores elegibles para esta ronda"
                >
                  <ListChecks className="w-4 h-4" />
                  Jugadores elegibles
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Jugadores */}
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

                  {/* Partidos */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Partidos</h3>
                    <div className="space-y-2">
                      {group.matches.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          No hay partidos programados
                        </div>
                      ) : (
                        group.matches.map((match) => (
                          <div
                            key={match.id}
                            className={`p-3 rounded border ${
                              match.isConfirmed ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
                            }`}
                          >
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
                                  <span
                                    className={`text-xs ${
                                      match.isConfirmed ? "text-green-600" : "text-yellow-600"
                                    }`}
                                  >
                                    {match.isConfirmed ? "Confirmado" : "Pendiente"}
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
        <div className="mt-8 flex flex-wrap justify-center gap-4">
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
              {isPending ? "Cerrando..." : "Cerrar Ronda"}
            </button>
          )}

          {round.isClosed && (
            <button
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              onClick={generateNextRound}
              disabled={isPending}
              title="(Opcional) Si no usas el cierre encadenado"
            >
              <Play className="w-4 h-4 mr-2" />
              {isPending ? "Generando..." : "Generar Siguiente"}
            </button>
          )}
        </div>
      </div>

      {/* Panel de Jugadores Elegibles (modal simple) */}
      {eligibleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEligibleOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-lg shadow-lg border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">Jugadores elegibles para esta ronda</h3>
              <button
                onClick={() => setEligibleOpen(false)}
                className="text-sm px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4">
              {eligibleLoading ? (
                <div className="text-sm text-gray-600">Cargando…</div>
              ) : eligibleError ? (
                <div className="text-sm text-red-600">{eligibleError}</div>
              ) : eligiblePlayers.length === 0 ? (
                <div className="text-sm text-gray-600">No hay jugadores elegibles.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-4">Jugador</th>
                        <th className="py-2 pr-4">Email</th>
                        <th className="py-2 pr-4">Se une desde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligiblePlayers.map((p) => (
                        <tr key={p.playerId} className="border-b">
                          <td className="py-2 pr-4">{p.name}</td>
                          <td className="py-2 pr-4">{p.email ?? "—"}</td>
                          <td className="py-2 pr-4">
                            {typeof p.joinedRound === "number" ? `Ronda ${p.joinedRound}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t text-right">
              <button
                onClick={() => setEligibleOpen(false)}
                className="inline-flex items-center px-3 py-2 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
