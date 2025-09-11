// app/admin/page.tsx - ACTUALIZADO para múltiples torneos
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import AdminDashboardClient from "./AdminDashboardClient";

export const metadata: Metadata = {
  title: "Dashboard Admin | PadelRis",
  description: "Panel de administración del torneo",
};

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  // 🔄 CAMBIO: Cargar TODOS los torneos, no solo el activo
  const tournaments = await prisma.tournament.findMany({
    orderBy: [
      { isActive: "desc" }, // Activos primero
      { startDate: "desc" }  // Más recientes primero
    ],
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

  if (!tournaments || tournaments.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-20 max-w-6xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              Panel de Administración
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">PadelRise Admin</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Gestiona torneos, rondas y jugadores desde tu panel de control
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 🎯 Torneo por defecto: el activo o el más reciente
  const defaultTournament = tournaments.find(t => t.isActive) || tournaments[0];

  // 📊 Calcular stats SOLO para el torneo por defecto (optimización)
  const roundsArr = defaultTournament.rounds as any[];

  const totalMatches = roundsArr.reduce(
    (acc, round) => acc + round.groups.reduce((gAcc: any, g: any) => gAcc + (g.matches?.length ?? 0), 0),
    0
  );

  const confirmedMatches = roundsArr.reduce(
    (acc, round) => acc + round.groups.reduce((gAcc: any, g: any) => gAcc + g.matches.filter((m: any) => !!m?.isConfirmed).length, 0),
    0
  );

  const pendingMatches = totalMatches - confirmedMatches;

  // 🔥 Stats de comodines para el torneo por defecto
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const comodinesAgg = await prisma.tournamentPlayer.aggregate({
    where: { tournamentId: defaultTournament.id },
    _sum: { comodinesUsed: true },
  });
  const comodinesUsados = comodinesAgg._sum.comodinesUsed || 0;

  const suplentesActivos = await prisma.groupPlayer.count({
    where: {
      substitutePlayerId: { not: null },
      group: { round: { tournamentId: defaultTournament.id, isClosed: false } },
    },
  });

  const gpsWithComodin = await prisma.groupPlayer.findMany({
    where: {
      usedComodin: true,
      group: { round: { tournamentId: defaultTournament.id, isClosed: false } },
    },
    select: { id: true, playerId: true, group: { select: { roundId: true } } },
  });

  const revocableChecks = await Promise.all(
    gpsWithComodin.map(async (gp) => {
      const blockingMatch = await prisma.match.findFirst({
        where: {
          group: { roundId: gp.group.roundId },
          AND: [
            {
              OR: [
                { team1Player1Id: gp.playerId },
                { team1Player2Id: gp.playerId },
                { team2Player1Id: gp.playerId },
                { team2Player2Id: gp.playerId },
              ],
            },
            {
              OR: [{ isConfirmed: true }, { acceptedDate: { lte: twentyFourHoursFromNow } }],
            },
          ],
        },
        select: { id: true },
      });
      return !blockingMatch;
    })
  );
  const revocables = revocableChecks.filter(Boolean).length;
  const mediaUsados = Math.round((comodinesUsados / Math.max(defaultTournament.players.length, 1)) * 100) / 100;

  // 🏗️ Serializar datos
  const serializedTournaments = tournaments.map(tournament => ({
    id: tournament.id,
    title: tournament.title,
    startDate: tournament.startDate.toISOString(),
    endDate: tournament.endDate ? tournament.endDate.toISOString() : "",
    totalRounds: tournament.totalRounds,
    roundDurationDays: tournament.roundDurationDays,
    isActive: tournament.isActive,
  }));

  const serializedRounds = roundsArr.map((round) => ({
    id: round.id,
    number: round.number,
    startDate: round.startDate.toISOString(),
    endDate: round.endDate ? round.endDate.toISOString() : "",
    isClosed: round.isClosed,
    groupsCount: round.groups.length,
    matchesCount: round.groups.reduce((acc: any, g: any) => acc + (g.matches?.length ?? 0), 0),
    pendingMatches: round.groups.reduce((acc: any, g: any) => acc + g.matches.filter((m: any) => !m.isConfirmed).length, 0),
  }));

  const stats = {
    totalPlayers: defaultTournament.players.length,
    totalRounds: roundsArr.length,
    activeRounds: roundsArr.filter((r: any) => !r.isClosed).length,
    totalMatches,
    confirmedMatches,
    pendingMatches,
    comodinesUsados,
    suplentesActivos,
    revocables,
    mediaUsados,
  };

  return (
    <AdminDashboardClient 
      tournaments={serializedTournaments}
      rounds={serializedRounds} 
      stats={stats}
      defaultTournamentId={defaultTournament.id}
    />
  );
}