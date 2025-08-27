"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, Clock, ChevronRight, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

type SerializedTournament = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
};

type SerializedRound = {
  id: string;
  number: number;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  groupsCount: number;
  pending: number;
  confirmed: number;
  status: "closed" | "upcoming" | "active" | "overdue";
  daysToStart: number;
  daysToEnd: number;
  hoursToEnd: number;
};

type RoundsClientProps = {
  tournament: SerializedTournament;
  rounds: SerializedRound[];
};

export default function RoundsClient({ tournament, rounds }: RoundsClientProps) {
  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Rondas</h1>
          <p className="text-gray-600">
            {tournament.title} • {format(new Date(tournament.startDate), "d MMM yyyy", { locale: es })} –{" "}
            {format(new Date(tournament.endDate), "d MMM yyyy", { locale: es })}
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {rounds.map((round) => (
            <RoundCard key={round.id} round={round} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RoundCard({ round }: { round: SerializedRound }) {
  const statusBadge = (() => {
    if (round.isClosed)
      return <Badge className="bg-gray-200 text-gray-800">Cerrada</Badge>;
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

  const closeRound = async () => {
    const ok = confirm("¿Cerrar esta ronda y aplicar movimientos?");
    if (!ok) return;
    
    try {
      const res = await fetch(`/api/rounds/${round.id}/close`, { method: "POST" });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("No se pudo cerrar la ronda.");
      }
    } catch (error) {
      alert("Error al cerrar la ronda.");
    }
  };

  const generateNext = async () => {
    const ok = confirm("¿Generar la siguiente ronda a partir de esta?");
    if (!ok) return;
    
    try {
      const res = await fetch(`/api/rounds/${round.id}/generate-next`, { method: "POST" });
      if (res.ok) {
        window.location.reload();
      } else {
        alert("No se pudo generar la siguiente ronda.");
      }
    } catch (error) {
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
            {new Date(round.startDate).toLocaleString("es-ES", {
              dateStyle: "medium",
            })}
          </p>
          <p>
            <b>Fin:</b>{" "}
            {new Date(round.endDate).toLocaleString("es-ES", {
              dateStyle: "medium",
            })}
          </p>
          <p>
            <b>Grupos:</b> {round.groupsCount}
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <p>
            <b>Resultados pendientes:</b> {round.pending}
          </p>
          <p>
            <b>Resultados confirmados:</b> {round.confirmed}
          </p>
          {!round.isClosed && round.status === "active" && (
            <p className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <span>
                Cierra en{" "}
                <b>
                  {round.daysToEnd > 0
                    ? `${round.daysToEnd} día(s)`
                    : `${Math.max(round.hoursToEnd, 0)} h`}
                </b>
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
          {!round.isClosed && (
            <Button onClick={closeRound} className="bg-emerald-600 hover:bg-emerald-700">
              Cerrar ronda
            </Button>
          )}
          <Button variant="outline" onClick={generateNext}>
            Generar siguiente
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/admin/results">Validar resultados</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}