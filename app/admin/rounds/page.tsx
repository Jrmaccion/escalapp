import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { differenceInDays, differenceInHours, isAfter, isBefore } from "date-fns";
import RoundsClient from "./RoundsClient";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Rondas | Escalapp",
  description: "Gestión de rondas del torneo",
};

export default async function AdminRoundsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  // Torneo activo
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    orderBy: { startDate: "asc" },
  });

  if (!tournament) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>No hay torneo activo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Crea un torneo para gestionar sus rondas.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const rounds = await prisma.round.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { number: "asc" },
    include: {
      groups: true,
    },
  });

  // Enriquecemos con contadores y estado
  const enhanced = await Promise.all(
    rounds.map(async (r) => {
      const pending = await prisma.match.count({
        where: { isConfirmed: false, group: { roundId: r.id } },
      });
      const confirmed = await prisma.match.count({
        where: { isConfirmed: true, group: { roundId: r.id } },
      });

      const now = new Date();
      const status = r.isClosed
        ? "closed"
        : isBefore(now, r.startDate)
        ? "upcoming"
        : isAfter(now, r.endDate)
        ? "overdue"
        : "active";

      const daysToStart = differenceInDays(r.startDate, now);
      const daysToEnd = differenceInDays(r.endDate, now);
      const hoursToEnd = differenceInHours(r.endDate, now);

      return {
        ...r,
        pending,
        confirmed,
        status,
        daysToStart,
        daysToEnd,
        hoursToEnd,
      };
    })
  );

  // Serialización para el cliente
  const serializedTournament = {
    id: tournament.id,
    title: tournament.title,
    startDate: tournament.startDate.toISOString(),
    endDate: tournament.endDate.toISOString(),
  };

  const serializedRounds = enhanced.map((r) => ({
    id: r.id,
    number: r.number,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    isClosed: r.isClosed,
    groupsCount: r.groups.length,
    pending: r.pending,
    confirmed: r.confirmed,
    status: r.status as "closed" | "upcoming" | "overdue" | "active",
    daysToStart: r.daysToStart,
    daysToEnd: r.daysToEnd,
    hoursToEnd: r.hoursToEnd,
  }));

  // Cabecera de navegación + chips de ronda
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Toolbar de navegación */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Rondas del Torneo
            </h1>
            <p className="text-gray-600">
              {tournament.title} ·{" "}
              {format(tournament.startDate, "PPP", { locale: es })} —{" "}
              {format(tournament.endDate, "PPP", { locale: es })}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50"
            >
              ← Panel
            </Link>
            <Link
              href="/admin/tournaments"
              className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50"
            >
              Torneos
            </Link>
            <Link
              href="/admin/players"
              className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50"
            >
              Jugadores
            </Link>
            <Link
              href="/admin/rankings"
              className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50"
            >
              Rankings
            </Link>
            <Link
              href={`/admin/tournaments/${tournament.id}`}
              className="inline-flex items-center px-3 py-2 rounded-lg border border-blue-600 text-blue-600 bg-white text-sm font-semibold hover:bg-blue-50"
            >
              Detalle del Torneo
            </Link>
          </div>
        </div>

        {/* Saltos rápidos por ronda */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {serializedRounds.map((r) => (
              <a
                key={r.id}
                href={`#ronda-${r.number}`}
                className="inline-flex items-center px-3 py-2 rounded-full text-sm bg-white border border-gray-200 hover:bg-gray-50 shadow-sm"
              >
                Ronda {r.number}
              </a>
            ))}
          </div>
        </div>

        {/* Contenido del cliente */}
        {/* Nota: si tu RoundsClient no pinta anclas, no pasa nada; los enlaces seguirán arriba. 
            Si quieres, puedes hacer que RoundsClient añada id={`ronda-${round.number}`} en cada bloque. */}
        <RoundsClient tournament={serializedTournament} rounds={serializedRounds} />
      </div>
    </main>
  );
}
