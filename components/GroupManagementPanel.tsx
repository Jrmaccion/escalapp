// components/GroupManagementPanel.tsx - VERSIÓN COMPATIBLE (acepta tournament o tournamentTitle)
"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Settings,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  Crown,
} from "lucide-react";

type SimplePlayer = {
  id: string;
  name: string;
  position: number;
};

type SimpleGroup = {
  id: string;
  number: number;
  players: SimplePlayer[];
};

type TournamentInfo = {
  id: string;
  title: string;
  totalPlayers: number;
};

type SimpleProps = {
  roundId: string;
  roundNumber: number;
  /** Legacy: algunos callers envían un string suelto */
  tournamentTitle?: string;
  /** Nuevo: callers envían objeto con info del torneo */
  tournament?: TournamentInfo;
  groups: SimpleGroup[];
  availablePlayers: number;
  isAdmin?: boolean;
  isClosed?: boolean;
};

export default function GroupManagementPanel({
  roundId,
  roundNumber,
  tournamentTitle,
  tournament,
  groups,
  availablePlayers,
  isAdmin = true,
  isClosed = false,
}: SimpleProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] =
    useState<"overview" | "create" | "manage">("overview");

  const title = tournament?.title ?? tournamentTitle ?? "Torneo";
  const hasGroups = groups.length > 0;
  const playersPerGroup = 4;
  const canCreateGroups =
    availablePlayers >= 4 && availablePlayers % playersPerGroup === 0;
  const groupsNeeded = Math.floor(availablePlayers / playersPerGroup);

  const toast = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const safeFetch = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Error de servidor");
    return data;
  };

  // Crear o regenerar grupos
  const handleCreateGroups = async (force = false) => {
    if (!isAdmin || isClosed) return;
    const action = hasGroups ? "regenerar" : "crear";
    const confirmMsg = hasGroups
      ? `¿Regenerar todos los grupos? Se eliminarán los ${groups.length} grupos existentes.`
      : `¿Crear ${groupsNeeded} grupos de 4 jugadores?`;

    if (!confirm(confirmMsg)) return;

    startTransition(async () => {
      try {
        await safeFetch(`/api/rounds/${roundId}/generate-groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strategy: roundNumber === 1 ? "random" : "ranking",
            playersPerGroup,
            force,
          }),
        });
        toast(`Grupos ${action}dos correctamente`);
        // Forzamos recarga para simplificar estado
        window.location.reload();
      } catch (e: any) {
        setError(e.message || `Error al ${action} grupos`);
      }
    });
  };

  // Generar partidos de la ronda (si tu API los soporta)
  const handleGenerateMatches = async () => {
    if (!hasGroups) {
      setError("Primero debes crear grupos");
      return;
    }
    if (isClosed) {
      setError("La ronda está cerrada");
      return;
    }

    startTransition(async () => {
      try {
        await safeFetch(`/api/rounds/${roundId}/generate-matches`, {
          method: "POST",
        });
        toast("Partidos generados correctamente");
        window.location.reload();
      } catch (e: any) {
        setError(e.message || "Error al generar partidos");
      }
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="w-full flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Gestión de grupos — {title} • Ronda {roundNumber}
          </span>
          <div className="flex items-center gap-2">
            {isClosed ? (
              <Badge variant="secondary">Ronda cerrada</Badge>
            ) : (
              <Badge variant="default">Ronda abierta</Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
              title="Refrescar"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mensajes */}
        {message && (
          <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            {message}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Acciones principales */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => handleCreateGroups(false)}
            disabled={!isAdmin || isClosed || (!hasGroups && !canCreateGroups) || isPending}
          >
            <Settings className="w-4 h-4 mr-2" />
            {hasGroups ? "Regenerar grupos" : "Crear grupos"}
          </Button>

          <Button
            onClick={handleGenerateMatches}
            disabled={!isAdmin || isClosed || !hasGroups || isPending}
            variant="outline"
          >
            <Play className="w-4 h-4 mr-2" />
            Generar partidos
          </Button>

          {tournament?.totalPlayers ? (
            <Badge variant="outline" className="ml-auto">
              <Crown className="w-3 h-3 mr-1" />
              {tournament.totalPlayers} jugadores
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-auto">
              <Users className="w-3 h-3 mr-1" />
              {availablePlayers} disponibles
            </Badge>
          )}
        </div>

        {/* Vista de grupos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <Card key={g.id} className="border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Grupo {g.number}</span>
                  <Badge variant="secondary">
                    {g.players.length}/{playersPerGroup}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {g.players.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate">{p.name}</span>
                      <Badge variant="outline">#{p.position}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
          {groups.length === 0 && (
            <div className="p-6 bg-gray-50 border rounded">
              <p className="text-sm text-gray-600">
                No hay grupos todavía. {canCreateGroups
                  ? "Puedes crearlos con el botón de arriba."
                  : "Necesitas un número de jugadores múltiplo de 4."}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
