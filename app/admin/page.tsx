import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";
import AdminDashboardClient from "./AdminDashboardClient";

export const metadata: Metadata = {
  title: "Dashboard Admin | Escalapp",
  description: "Panel de administración del torneo",
};

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  // Obtener torneo activo con relaciones necesarias
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    include: {
      rounds: {
        orderBy: { number: "asc" },
        include: {
          groups: {
            include: {
              matches: true,
            },
          },
        },
      },
      players: true,
    },
  });

  // Estado sin torneo
  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-20 max-w-6xl">
          {/* Header con navegación */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              Panel de Administración
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Escalapp Admin</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Gestiona torneos, rondas y jugadores desde tu panel de control
            </p>
          </div>

          {/* Estado sin torneo */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-12 text-center">
                <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                    />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">No hay torneo activo</h2>
                <p className="text-blue-100 text-lg max-w-md mx-auto">
                  Para comenzar a gestionar partidos y jugadores, primero necesitas crear y activar un torneo.
                </p>
              </div>

              <div className="px-8 py-8">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Acciones principales */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Primeros pasos</h3>
                    <div className="space-y-4">
                      <Link
                        href="/admin/tournaments"
                        className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all group"
                      >
                        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-semibold text-blue-900">Crear Torneo</div>
                          <div className="text-sm text-blue-700">Configura un nuevo torneo desde cero</div>
                        </div>
                      </Link>

                      <Link
                        href="/admin/players"
                        className="flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl hover:from-green-100 hover:to-green-200 transition-all group"
                      >
                        <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                        </div>
                        <div>
                          <div className="font-semibold text-green-900">Ver Jugadores</div>
                          <div className="text-sm text-green-700">Gestiona usuarios registrados</div>
                        </div>
                      </Link>

                      <Link
                        href="/admin/rankings"
                        className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all group"
                      >
                        <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <div className="font-semibold text-purple-900">Rankings</div>
                          <div className="text-sm text-purple-700">Ver clasificaciones históricas</div>
                        </div>
                      </Link>
                    </div>
                  </div>

                  {/* Información y guía */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">¿Cómo empezar?</h3>
                    <div className="bg-gray-50 rounded-xl p-6">
                      <ol className="space-y-4">
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                            1
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">Crear un torneo</div>
                            <div className="text-sm text-gray-600">Define las fechas, número de rondas y configuración</div>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                            2
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">Activar el torneo</div>
                            <div className="text-sm text-gray-600">Marca el torneo como activo para comenzar</div>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                            3
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">Generar rondas</div>
                            <div className="text-sm text-gray-600">El sistema creará automáticamente grupos y partidos</div>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                            ✓
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">¡Listo para gestionar!</div>
                            <div className="text-sm text-gray-600">Valida resultados y controla el progreso</div>
                          </div>
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* CTA Principal */}
                <div className="text-center mt-12">
                  <Link
                    href="/admin/tournaments"
                    className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Crear Mi Primer Torneo
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Cálculo de estadísticas (tipos inline, sin Prisma helpers) ----
  type MatchLite = { isConfirmed?: boolean | null };
  type GroupLite = { matches: MatchLite[] };
  type RoundLite = {
    id: string;
    number: number;
    startDate: Date;
    endDate: Date | null;
    isClosed: boolean;
    groups: GroupLite[];
  };

  const roundsArr = tournament.rounds as unknown as RoundLite[];

  const totalMatches = roundsArr.reduce(
    (acc, round) => acc + round.groups.reduce((gAcc, g) => gAcc + (g.matches?.length ?? 0), 0),
    0
  );

  const confirmedMatches = roundsArr.reduce(
    (acc, round) =>
      acc +
      round.groups.reduce((gAcc, g) => gAcc + g.matches.filter((m) => !!m?.isConfirmed).length, 0),
    0
  );

  const pendingMatches = totalMatches - confirmedMatches;

  const stats = {
    totalPlayers: tournament.players.length,
    totalRounds: roundsArr.length,
    activeRounds: roundsArr.filter((r) => !r.isClosed).length,
    totalMatches,
    confirmedMatches,
    pendingMatches,
  };

  // ---- Serialización (endDate string vacía si falta) ----
  const serializedTournament = {
    id: tournament.id,
    title: tournament.title,
    startDate: tournament.startDate.toISOString(),
    endDate: tournament.endDate ? tournament.endDate.toISOString() : "",
    totalRounds: tournament.totalRounds,
    roundDurationDays: tournament.roundDurationDays,
  };

  const serializedRounds = roundsArr.map((round) => ({
    id: round.id,
    number: round.number,
    startDate: round.startDate.toISOString(),
    endDate: round.endDate ? round.endDate.toISOString() : "",
    isClosed: round.isClosed,
    groupsCount: round.groups.length,
    matchesCount: round.groups.reduce((acc, g) => acc + (g.matches?.length ?? 0), 0),
    pendingMatches: round.groups.reduce(
      (acc, g) => acc + g.matches.filter((m) => !m.isConfirmed).length,
      0
    ),
  }));

  return (
    <AdminDashboardClient
      tournament={serializedTournament}
      rounds={serializedRounds}
      stats={stats}
    />
  );
}
