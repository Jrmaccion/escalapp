"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, Clock, ChevronRight, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { useMemo } from "react";

type SerializedTournament = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
};

type SerializedRound = {
  id: string;
  number: number;
  startDate: string; // ISO
  endDate: string;   // ISO
  isClosed: boolean;
  groupsCount: number;
  pending: number;     // sets sin confirmar
  confirmed: number;   // sets confirmados
  status: "closed" | "upcoming" | "active" | "overdue";
  daysToStart: number;
  daysToEnd: number;
  hoursToEnd: number;
  totalPlayersInRound?: number;
  groupsWithEnoughPlayers?: number;
  canGenerateMatches?: boolean;
};

type RoundsClientProps = {
  tournament: SerializedTournament;
  rounds: SerializedRound[];
  isAdmin?: boolean;
};

export default function RoundsClient({ tournament, rounds, isAdmin = false }: RoundsClientProps) {
  const lastRoundNumber = useMemo(
    () => (rounds.length ? Math.max(...rounds.map((r) => r.number)) : null),
    [rounds]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {rounds.map((round) => (
          <RoundCard
            key={round.id}
            round={round}
            isAdmin={isAdmin}
            isLast={lastRoundNumber !== null && round.number === lastRoundNumber}
          />
        ))}
      </div>
    </div>
  );
}

function RoundCard({
  round,
  isAdmin,
  isLast,
}: {
  round: SerializedRound;
  isAdmin: boolean;
  isLast: boolean;
}) {
  const statusBadge = (() => {
    if (round.isClosed) return <Badge className="bg-gray-200 text-gray-800">Cerrada</Badge>;
    switch (round.status) {
      case "upcoming":
        return <Badge className="bg-blue-100 text-blue-700">Próxima</Badge>;
      case "active":
        return <Badge className="bg-green-100 text-green-700">Activa</Badge>;
      case "overdue":
        return <Badge variant="destructive">Fuera de plazo</Badge>;
      default:
        return <Badge variant="secondary">—</Badge>;
    }
  })();

  // Reglas de habilitación:
  const hasPending = round.pending > 0;
  const notStarted = round.status === "upcoming";
  const closeDisabledReason =
    !isLast ? "Solo se cierra la última ronda" :
    round.isClosed ? "Ya está cerrada" :
    hasPending ? "Hay sets pendientes por confirmar" :
    notStarted ? "La ronda aún no ha comenzado" :
    null;

  const genDisabledReason =
    !isLast ? "Solo se genera desde la última ronda" :
    hasPending ? "Hay sets pendientes por confirmar" :
    notStarted ? "La ronda aún no ha comenzado" :
    null;

  const closeRound = async () => {
    if (!isAdmin) return alert("Solo los administradores pueden cerrar rondas");
    if (!isLast) return alert("Solo se puede cerrar la última ronda");

    if (round.isClosed) return alert("Esta ronda ya está cerrada");
    if (hasPending) return alert("No puedes cerrar con sets pendientes");
    if (notStarted) return alert("La ronda aún no ha comenzado");

    const ok = confirm("¿Cerrar esta ronda y aplicar movimientos?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/rounds/${round.id}/close`, { method: "POST" });
      const text = await res.text();
      if (!res.ok) {
        try {
          const j = JSON.parse(text);
          alert(j?.error || "No se pudo cerrar la ronda.");
        } catch {
          alert(text || "No se pudo cerrar la ronda.");
        }
        return;
      }
      // Puede que ya genere la siguiente ronda:
      try {
        const j = JSON.parse(text);
        if (typeof j?.nextRoundId === "string") {
          window.location.href = `/admin/rounds/${j.nextRoundId}`;
          return;
        }
      } catch {}
      window.location.reload();
    } catch {
      alert("Error al cerrar la ronda.");
    }
  };

  const generateNext = async () => {
    if (!isAdmin) return alert("Solo los administradores pueden generar rondas");
    if (!isLast) return alert("Solo se puede generar desde la última ronda");
    if (hasPending) return alert("No puedes generar con sets pendientes");
    if (notStarted) return alert("La ronda aún no ha comenzado");

    const ok = confirm(
      round.isClosed
        ? "¿Generar la siguiente ronda a partir de esta ronda cerrada?"
        : "¿Cerrar esta ronda y generar la siguiente?"
    );
    if (!ok) return;

    try {
      // Usamos el endpoint oficial de cierre que también genera la siguiente
      const res = await fetch(`/api/rounds/${round.id}/close`, { method: "POST" });
      const text = await res.text();
      if (!res.ok) {
        try {
          const j = JSON.parse(text);
          alert(j?.error || "No se pudo generar la siguiente ronda.");
        } catch {
          alert(text || "No se pudo generar la siguiente ronda.");
        }
        return;
      }
      try {
        const j = JSON.parse(text);
        if (typeof j?.nextRoundId === "string") {
          window.location.href = `/admin/rounds/${j.nextRoundId}`;
          return;
        }
        alert(j?.message || "Ronda cerrada. No se generó una nueva.");
      } catch {
        // Si no es JSON, recargamos
      }
      window.location.reload();
    } catch {
      alert("Error al generar la siguiente ronda.");
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" />
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <CardTitle>Ronda {round.number}</CardTitle>
          {statusBadge}
          {isLast && <Badge variant="outline">Última</Badge>}
        </div>
        <Link
          href={`/admin/rounds/${round.id}`}
          className="text-sm text-blue-600 hover:underline flex items-center"
        >
          Detalle <ChevronRight className="w-4 h-4 ml-1" />
        </Link>
      </CardHeader>

      <CardContent className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2 text-sm">
          <p>
            <b>Inicio:</b>{" "}
            {format(new Date(round.startDate), "d MMM", { locale: es })}
          </p>
          <p>
            <b>Fin:</b>{" "}
            {format(new Date(round.endDate), "d MMM", { locale: es })}
          </p>
          <p>
            <b>Grupos:</b> {round.groupsCount}
          </p>
          {round.totalPlayersInRound !== undefined && (
            <p>
              <b>Jugadores:</b> {round.totalPlayersInRound}
            </p>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <p>
            <b>Pendientes:</b> {round.pending}
          </p>
          <p>
            <b>Confirmados:</b> {round.confirmed}
          </p>
          {round.canGenerateMatches !== undefined && (
            <p className="flex items-center gap-2">
              {round.canGenerateMatches ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-green-700">Listo para partidos</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span className="text-orange-700">Faltan jugadores</span>
                </>
              )}
            </p>
          )}
          {!round.isClosed && round.status === "active" && (
            <p className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <span>
                Cierra en <b>{round.daysToEnd > 0 ? `${round.daysToEnd} día(s)` : `${Math.max(round.hoursToEnd, 0)} h`}</b>
              </span>
            </p>
          )}
          {!round.isClosed && round.status === "upcoming" && (
            <p className="flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-green-600" />
              <span>Empieza en <b>{round.daysToStart} día(s)</b></span>
            </p>
          )}
          {round.isClosed && (
            <p className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Ronda cerrada</span>
            </p>
          )}
        </div>

        <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
          {isAdmin && !round.isClosed && isLast && (
            <Button
              onClick={closeRound}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!!closeDisabledReason}
              title={closeDisabledReason ?? ""}
            >
              Cerrar ronda
            </Button>
          )}
          {isAdmin && isLast && (
            <Button
              variant="outline"
              onClick={generateNext}
              disabled={!!genDisabledReason}
              title={genDisabledReason ?? ""}
            >
              {round.isClosed ? "Generar siguiente" : "Cerrar y generar"}
            </Button>
          )}
          {isAdmin && (
            <Button variant="ghost" asChild>
              <Link href="/admin/results">Validar resultados</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
