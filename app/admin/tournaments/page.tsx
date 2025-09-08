import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import TournamentsClient from "./TournamentsClient";
import { differenceInDays, isAfter, isBefore } from "date-fns";

export const metadata: Metadata = {
  title: "Torneos | UP!adel",
  description: "Gestión de torneos",
};

type SerializedTournament = {
  id: string;
  title: string;
  startDateISO: string;
  endDateISO: string;
  startDateText: string; // ya formateado Europe/Madrid
  endDateText: string;   // ya formateado Europe/Madrid
  totalRounds: number;
  roundDurationDays: number;
  isActive: boolean;
  isPublic: boolean;
  playersCount: number;
  roundsCount: number;
  status: "active" | "finished" | "upcoming" | "inactive";
  daysToStart: number | null;
  daysToEnd: number | null;
};

// Formateo 100% en servidor: TZ y locale fijos (evita hydration mismatch)
const esMadridFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "numeric",
  month: "long",
  year: "numeric",
});
function formatES(d: Date) {
  return esMadridFormatter.format(d); // ej. "7 de septiembre de 2025"
}

export default async function AdminTournamentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  const tournaments = await prisma.tournament.findMany({
    orderBy: { startDate: "desc" },
    include: {
      rounds: true,
      players: { include: { player: true } },
    },
  });

  const now = new Date();

  const serializedTournaments: SerializedTournament[] = tournaments.map((t) => {
    const start = new Date(t.startDate);
    const end = new Date(t.endDate);

    const status: SerializedTournament["status"] =
      t.isActive
        ? "active"
        : isAfter(now, end)
        ? "finished"
        : isBefore(now, start)
        ? "upcoming"
        : "inactive";

    const daysToStart = isBefore(now, start) ? differenceInDays(start, now) : null;
    const daysToEnd = isAfter(end, now) ? differenceInDays(end, now) : null;

    return {
      id: t.id,
      title: t.title,
      startDateISO: start.toISOString(),
      endDateISO: end.toISOString(),
      startDateText: formatES(start),
      endDateText: formatES(end),
      totalRounds: t.totalRounds,
      roundDurationDays: t.roundDurationDays,
      isActive: t.isActive,
      isPublic: t.isPublic,
      playersCount: t.players.length,
      roundsCount: t.rounds.length,
      status,
      daysToStart,
      daysToEnd,
    };
  });

  return (
    <div className="tournaments-full-width">
      <div className="tournaments-content">
        <TournamentsClient tournaments={serializedTournaments} />
      </div>
    </div>
  );
}
