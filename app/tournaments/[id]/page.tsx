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
    <div className="tournament-full-width min-h-screen bg-gray-50/50">
      {/* Header con ancho completo */}
      <div className="w-full bg-white border-b border-gray-200">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4">
            <header className="flex flex-col gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                {tournament.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                {firstRound && lastRound ? (
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>
                      {fmt(tournament.startDate)} — {fmt(tournament.endDate)}
                    </span>
                  </div>
                ) : (
                  <span className="text-amber-600">Temporada en preparación</span>
                )}
                
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <span>{tournament.totalRounds} rondas</span>
                </div>
                
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{tournament.roundDurationDays} días por ronda</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                    tournament.isActive 
                      ? "bg-green-100 text-green-700 border border-green-200" 
                      : "bg-gray-100 text-gray-700 border border-gray-200"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${tournament.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                  {tournament.isActive ? "Torneo Activo" : "Torneo Inactivo"}
                </span>
                
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                    tournament.isPublic 
                      ? "bg-blue-100 text-blue-700 border border-blue-200" 
                      : "bg-amber-100 text-amber-700 border border-amber-200"
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {tournament.isPublic ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    )}
                  </svg>
                  {tournament.isPublic ? "Público" : "Privado"}
                </span>
                
                {currentRound && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 border border-indigo-200">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Ronda actual: {currentRound.number}
                    {currentRound.startDate && currentRound.endDate && (
                      <span className="hidden sm:inline">
                        • {format(new Date(currentRound.startDate), "d MMM", { locale: es })} - {format(new Date(currentRound.endDate), "d MMM", { locale: es })}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </header>
          </div>
        </div>
      </div>

      {/* Main content con ancho completo forzado */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-full">
          <TournamentTimeline tournamentId={tournament.id} />
        </div>
      </main>
    </div>
  );
}