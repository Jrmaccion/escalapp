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
import Breadcrumbs from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Rondas | PadelRise",
  description: "Gestión de rondas del torneo",
};

export default async function AdminRoundsPage({
  searchParams,
}: {
  searchParams: { tournament?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  
  const isAdmin = !!session.user?.isAdmin;
  const playerId = session.user?.playerId;

  // Obtener torneos disponibles según el rol del usuario
  let availableTournaments;
  if (isAdmin) {
    // Admin ve todos los torneos
    availableTournaments = await prisma.tournament.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        isActive: true,
        _count: {
          select: { rounds: true }
        }
      }
    });
  } else {
    // Jugador solo ve torneos en los que está inscrito
    if (!playerId) {
      return (
        <div className="min-h-screen bg-gray-50 py-10">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h1 className="text-2xl font-bold mb-4">No tienes perfil de jugador</h1>
            <p className="text-gray-600">Contacta con el administrador.</p>
          </div>
        </div>
      );
    }

    availableTournaments = await prisma.tournament.findMany({
      where: {
        players: {
          some: { playerId }
        }
      },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        isActive: true,
        _count: {
          select: { rounds: true }
        }
      }
    });
  }

  if (availableTournaments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 max-w-4xl">
          <Breadcrumbs />
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold mb-4">
              {isAdmin ? "No hay torneos creados" : "No estás inscrito en ningún torneo"}
            </h1>
            <p className="text-gray-600 mb-6">
              {isAdmin 
                ? "Crea un torneo para gestionar sus rondas."
                : "Contacta con el administrador para unirte a un torneo."
              }
            </p>
            {isAdmin && (
              <Link
                href="/admin/tournaments"
                className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50"
              >
                Gestionar Torneos
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Determinar torneo seleccionado
  const selectedTournamentId = searchParams.tournament || availableTournaments[0].id;
  const selectedTournament = availableTournaments.find(t => t.id === selectedTournamentId) 
    || availableTournaments[0];

  // Obtener rondas del torneo seleccionado
  const rounds = await prisma.round.findMany({
    where: { tournamentId: selectedTournament.id },
    orderBy: { number: "asc" },
    include: {
      groups: {
        include: {
          players: {
            include: {
              player: true
            }
          },
          matches: true
        }
      },
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

      // Calcular estadísticas de jugadores
      const totalPlayersInRound = r.groups.reduce((acc, group) => acc + group.players.length, 0);
      const groupsWithEnoughPlayers = r.groups.filter(group => group.players.length >= 4).length;
      const canGenerateMatches = r.groups.every(group => group.players.length % 4 === 0 && group.players.length >= 4);

      return {
        ...r,
        pending,
        confirmed,
        status,
        daysToStart,
        daysToEnd,
        hoursToEnd,
        totalPlayersInRound,
        groupsWithEnoughPlayers,
        canGenerateMatches,
      };
    })
  );

  // Serialización para el cliente
  const serializedTournaments = availableTournaments.map((t) => ({
    id: t.id,
    title: t.title,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    isActive: t.isActive,
    roundsCount: t._count.rounds,
  }));

  const serializedTournament = {
    id: selectedTournament.id,
    title: selectedTournament.title,
    startDate: selectedTournament.startDate.toISOString(),
    endDate: selectedTournament.endDate.toISOString(),
    isActive: selectedTournament.isActive,
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
    totalPlayersInRound: r.totalPlayersInRound,
    groupsWithEnoughPlayers: r.groupsWithEnoughPlayers,
    canGenerateMatches: r.canGenerateMatches,
  }));

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <Breadcrumbs />
        
        {/* Toolbar de navegación y selector de torneo */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Rondas {isAdmin ? "- Admin" : ""}
            </h1>
            <p className="text-gray-600">
              Gestión y seguimiento de rondas del torneo
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <>
                <Link
                  href="/admin"
                  className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50"
                >
                  ← Panel Admin
                </Link>
                <Link
                  href="/admin/tournaments"
                  className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50"
                >
                  Torneos
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Selector de torneo */}
        {availableTournaments.length > 1 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Seleccionar Torneo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {serializedTournaments.map((tournament) => (
                  <Link
                    key={tournament.id}
                    href={`/admin/rounds?tournament=${tournament.id}`}
                    className={`block p-4 rounded-lg border transition-colors ${
                      tournament.id === selectedTournament.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium truncate">{tournament.title}</h3>
                      {tournament.isActive && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          Activo
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {format(new Date(tournament.startDate), "MMM yyyy", { locale: es })} - {" "}
                      {format(new Date(tournament.endDate), "MMM yyyy", { locale: es })}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {tournament.roundsCount} rondas
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Información del torneo seleccionado */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{selectedTournament.title}</h2>
              <p className="text-gray-600">
                {format(new Date(selectedTournament.startDate), "PPP", { locale: es })} - {" "}
                {format(new Date(selectedTournament.endDate), "PPP", { locale: es })}
              </p>
            </div>
            {selectedTournament.isActive && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                Torneo Activo
              </span>
            )}
          </div>
        </div>

        {/* Contenido del cliente con las rondas */}
        <RoundsClient 
          tournament={serializedTournament} 
          rounds={serializedRounds} 
          isAdmin={isAdmin}
        />
      </div>
    </main>
  );
}