// app/tournaments/page.tsx
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const metadata = {
  title: "Torneos | Escalapp",
  description: "Accede a los torneos disponibles",
};

export default async function TournamentsPage() {
  // Buscar el torneo activo
  const activeTournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    include: {
      rounds: {
        select: { id: true, number: true, isClosed: true, startDate: true, endDate: true },
        orderBy: { number: "asc" },
      },
      players: {
        select: { id: true },
      },
    },
  });

  // Si hay un torneo activo, redirigir automáticamente
  if (activeTournament) {
    redirect(`/tournaments/${activeTournament.id}`);
  }

  // Si no hay torneo activo, buscar torneos disponibles
  const availableTournaments = await prisma.tournament.findMany({
    where: { 
      OR: [
        { isPublic: true },
        { isActive: false, endDate: { gt: new Date() } }
      ]
    },
    orderBy: [
      { isActive: "desc" },
      { startDate: "desc" }
    ],
    take: 10,
    include: {
      rounds: {
        select: { id: true, number: true, isClosed: true, startDate: true, endDate: true },
        orderBy: { number: "asc" },
      },
      players: {
        select: { id: true },
      },
    },
  });

  if (availableTournaments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No hay torneos disponibles</h2>
          <p className="text-gray-600 mb-6">
            No hay torneos activos o públicos en este momento.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Volver al dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Seleccionar Torneo</h1>
          <p className="text-gray-600">
            No hay un torneo activo. Puedes consultar los siguientes torneos disponibles:
          </p>
        </div>

        <div className="grid gap-6">
          {availableTournaments.map((tournament) => {
            const isUpcoming = new Date() < tournament.startDate;
            const isFinished = new Date() > tournament.endDate;
            const currentRound = tournament.rounds?.find(r => !r.isClosed) || tournament.rounds?.at(-1);

            return (
              <Link
                key={tournament.id}
                href={`/tournaments/${tournament.id}`}
                className="block bg-white rounded-lg shadow border hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {tournament.title}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          tournament.isActive 
                            ? 'bg-green-100 text-green-800'
                            : isUpcoming 
                              ? 'bg-blue-100 text-blue-800'
                              : isFinished
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {tournament.isActive ? 'Activo' : 
                           isUpcoming ? 'Próximo' : 
                           isFinished ? 'Finalizado' : 'Inactivo'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>
                            {format(tournament.startDate, "d MMM", { locale: es })} - {format(tournament.endDate, "d MMM yyyy", { locale: es })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span>{tournament.players?.length || 0} jugadores</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                          <span>{tournament.totalRounds} rondas • {tournament.roundDurationDays} días/ronda</span>
                        </div>
                      </div>

                      {currentRound && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">
                            {tournament.isActive ? 'Ronda actual: ' : 'Última ronda: '}
                            {currentRound.number}
                          </span>
                          {currentRound.startDate && currentRound.endDate && (
                            <span className="ml-2 text-gray-500">
                              ({format(new Date(currentRound.startDate), "d MMM", { locale: es })} - {format(new Date(currentRound.endDate), "d MMM", { locale: es })})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0 ml-4">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Volver al dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}