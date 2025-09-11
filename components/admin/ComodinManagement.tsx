// components/admin/ComodinManagement.tsx - VERSIÓN CORREGIDA sin Prisma
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// ✅ CORREGIDO: Usar el archivo client que NO importa Prisma
import { comodinApi, PlayerComodinStatus, RoundComodinStats } from "@/lib/api/comodin.client";

type Props = {
  roundId: string;
  roundNumber: number;
  tournamentName: string;
  onComodinRevoked?: () => void;
};

export default function ComodinManagement({
  roundId,
  roundNumber,
  tournamentName,
  onComodinRevoked,
}: Props) {
  const [players, setPlayers] = useState<PlayerComodinStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingPlayer, setRevokingPlayer] = useState<string | null>(null);
  const [counters, setCounters] = useState<{ total: number; withComodin: number; revocables: number }>({
    total: 0,
    withComodin: 0,
    revocables: 0,
  });

  // Cargar estado de comodines de todos los jugadores (admin)
  const loadPlayersComodinStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data: RoundComodinStats = await comodinApi.getRoundStats(roundId);
      setPlayers(data.players || []);
      setCounters({
        total: data.totalPlayers ?? data.players.length,
        withComodin: data.withComodin ?? data.players.filter((p) => p.usedComodin).length,
        revocables: data.revocables ?? data.players.filter((p) => p.canRevoke).length,
      });
    } catch (err: any) {
      setError(err?.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  // Revocar comodín específico (admin)
  const revokePlayerComodin = async (playerId: string, playerName: string) => {
    if (!confirm(`¿Estás seguro de que quieres revocar el comodín de ${playerName}?`)) return;

    try {
      setRevokingPlayer(playerId);
      await comodinApi.adminRevoke(roundId, playerId);
      await loadPlayersComodinStatus(); // recargar datos
      onComodinRevoked?.();
    } catch (err: any) {
      alert(err?.message || "Error de conexión al revocar comodín");
    } finally {
      setRevokingPlayer(null);
    }
  };

  useEffect(() => {
    if (roundId) void loadPlayersComodinStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  const playersWithComodin = players.filter((p) => p.usedComodin);
  const playersWithoutComodin = players.filter((p) => !p.usedComodin);

  if (loading && players.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">Cargando estado de comodines...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Gestión de Comodines - Ronda {roundNumber}</h3>
          <p className="text-sm text-gray-600">{tournamentName}</p>
        </div>
        <Button onClick={loadPlayersComodinStatus} disabled={loading} variant="outline" size="sm">
          {loading ? "Cargando..." : "Actualizar"}
        </Button>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-sm text-red-600">{error}</div>
        </Card>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">{counters.total}</div>
          <div className="text-sm text-gray-600">Total jugadores</div>
        </Card>

        <Card className="p-4">
          <div className="text-2xl font-bold text-orange-600">{counters.withComodin}</div>
          <div className="text-sm text-gray-600">Con comodín usado</div>
        </Card>

        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">{counters.revocables}</div>
          <div className="text-sm text-gray-600">Revocables</div>
        </Card>
      </div>

      {/* Jugadores con comodín */}
      {playersWithComodin.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h4 className="font-medium text-gray-900">
              Jugadores con comodín aplicado ({playersWithComodin.length})
            </h4>
          </div>

          <div className="divide-y divide-gray-200">
            {playersWithComodin.map((player) => (
              <div key={player.playerId} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h5 className="font-medium text-gray-900">{player.playerName}</h5>
                      <Badge variant="secondary">Grupo {player.groupNumber}</Badge>
                      <Badge variant={player.comodinMode === "substitute" ? "default" : "outline"}>
                        {player.comodinMode === "substitute" ? "Sustituto" : "Media"}
                      </Badge>
                    </div>

                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        <strong>Puntos asignados:</strong>{" "}
                        {(player.points ?? 0).toFixed(1)}
                      </p>

                      {player.comodinMode === "substitute" && player.substitutePlayerName && (
                        <p>
                          <strong>Sustituto:</strong> {player.substitutePlayerName}
                        </p>
                      )}

                      {player.comodinReason && (
                        <p>
                          <strong>Detalle:</strong> {player.comodinReason}
                        </p>
                      )}

                      {player.appliedAt && (
                        <p>
                          <strong>Aplicado:</strong>{" "}
                          {new Date(player.appliedAt).toLocaleString("es-ES")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="ml-4">
                    {player.canRevoke ? (
                      <Button
                        onClick={() => revokePlayerComodin(player.playerId, player.playerName)}
                        disabled={revokingPlayer === player.playerId}
                        variant="destructive"
                        size="sm"
                      >
                        {revokingPlayer === player.playerId ? "Revocando..." : "Revocar"}
                      </Button>
                    ) : (
                      <div className="text-right">
                        <Badge variant="secondary">No revocable</Badge>
                        {player.restrictionReason && (
                          <p className="text-xs text-gray-500 mt-1 max-w-48">{player.restrictionReason}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Jugadores sin comodín */}
      {playersWithoutComodin.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h4 className="font-medium text-gray-900">
              Jugadores sin comodín ({playersWithoutComodin.length})
            </h4>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {playersWithoutComodin.map((player) => (
                <div key={player.playerId} className="flex items-center gap-2">
                  <div className="text-sm">
                    <div className="font-medium">{player.playerName}</div>
                    <div className="text-gray-500">
                      Grupo {player.groupNumber} - {(player.points ?? 0).toFixed(1)} pts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Estado vacío */}
      {players.length === 0 && !loading && !error && (
        <Card className="p-8 text-center">
          <div className="text-gray-500">No hay jugadores asignados a esta ronda</div>
        </Card>
      )}
    </div>
  );
}