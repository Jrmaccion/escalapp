// app/tournaments/[id]/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import TournamentTimeline from "@/components/tournament/TournamentTimeline";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type PageProps = { params: { id: string } };

export default async function TournamentPublicPage({ params }: PageProps) {
  const { id } = params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      rounds: {
        select: { id: true, number: true, isClosed: true, startDate: true, endDate: true },
        orderBy: { number: "asc" },
      },
    },
  });

  if (!tournament) {
    notFound();
  }

  // Privacidad: si el torneo no es público, requerimos sesión
  if (!tournament.isPublic) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/auth/login");
    // (Opcional) aquí podrías restringir más a participantes/admin si lo necesitas
  }

  const firstRound = tournament.rounds[0];
  const lastRound = tournament.rounds.at(-1);
  const currentRound =
    tournament.rounds.find((r) => !r.isClosed) ?? tournament.rounds.at(-1) ?? null;

  const fmt = (d: Date) => format(d, "d 'de' MMMM yyyy", { locale: es });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{tournament.title}</h1>
        <div className="text-sm text-muted-foreground">
          {firstRound && lastRound ? (
            <>
              Temporada: {fmt(tournament.startDate)} — {fmt(tournament.endDate)} ·{" "}
              {tournament.totalRounds} rondas · Duración por ronda:{" "}
              {tournament.roundDurationDays} días
            </>
          ) : (
            <>Temporada en preparación</>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${
              tournament.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
            }`}
          >
            {tournament.isActive ? "Activo" : "Inactivo"}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${
              tournament.isPublic ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {tournament.isPublic ? "Público" : "Privado"}
          </span>
          {currentRound && (
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
              Ronda actual: {currentRound.number}
              {currentRound.startDate && currentRound.endDate
                ? ` · ${fmt(currentRound.startDate)} — ${fmt(currentRound.endDate)}`
                : null}
            </span>
          )}
        </div>
      </header>

      {/* Gráfico y clasificación por movimientos */}
      <section>
        <TournamentTimeline tournamentId={tournament.id} />
      </section>

      {/* (Opcional) Puedes añadir aquí más widgets: reglas, ranking oficial/ironman, histórico, etc. */}
    </div>
  );
}
