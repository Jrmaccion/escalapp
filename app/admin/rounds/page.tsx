import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Metadata } from "next";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { differenceInDays, differenceInHours, isAfter, isBefore } from "date-fns";
import RoundsClient from "./RoundsClient";

export const metadata: Metadata = {
  title: "Rondas | Escalapp",
  description: "Gestión de rondas del torneo",
};

export default async function AdminRoundsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  // Torneo activo + sus rondas (ordenadas)
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
      groups: true, // relación: Round -> Group[]
    },
  });

  // Enriquecemos con contadores
  const enhanced = await Promise.all(
    rounds.map(async (r) => {
      const pending = await prisma.match.count({
        where: {
          isConfirmed: false,
          group: { roundId: r.id },
        },
      });

      const confirmed = await prisma.match.count({
        where: {
          isConfirmed: true,
          group: { roundId: r.id },
        },
      });

      // días y estado
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

  // Serializar los datos para el cliente
  const serializedTournament = {
    id: tournament.id,
    title: tournament.title,
    startDate: tournament.startDate.toISOString(),
    endDate: tournament.endDate.toISOString(),
  };

  const serializedRounds = enhanced.map(r => ({
    id: r.id,
    number: r.number,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    isClosed: r.isClosed,
    groupsCount: r.groups.length,
    pending: r.pending,
    confirmed: r.confirmed,
    status: r.status,
    daysToStart: r.daysToStart,
    daysToEnd: r.daysToEnd,
    hoursToEnd: r.hoursToEnd,
  }));

  return (
    <RoundsClient 
      tournament={serializedTournament} 
      rounds={serializedRounds} 
    />
  );
}