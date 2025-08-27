import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import AdminDashboardClient from "./AdminDashboardClient";

export const metadata: Metadata = {
  title: "Dashboard Admin | Escalapp",
  description: "Panel de administración del torneo",
};

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  // Obtener torneo activo
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    include: {
      rounds: {
        orderBy: { number: "asc" },
        include: {
          groups: {
            include: {
              matches: true,
            }
          }
        }
      },
      players: true,
    },
  });

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="text-2xl font-bold mb-4">No hay torneo activo</h1>
          <p className="text-gray-600">Crea un torneo para comenzar.</p>
        </div>
      </div>
    );
  }

  // Calcular estadísticas
  const stats = {
    totalPlayers: tournament.players.length,
    totalRounds: tournament.rounds.length,
    activeRounds: tournament.rounds.filter(r => !r.isClosed).length,
    totalMatches: tournament.rounds.reduce((acc, round) => 
      acc + round.groups.reduce((groupAcc, group) => groupAcc + group.matches.length, 0), 0
    ),
    pendingMatches: tournament.rounds.reduce((acc, round) => 
      acc + round.groups.reduce((groupAcc, group) => 
        groupAcc + group.matches.filter(m => !m.isConfirmed).length, 0
      ), 0
    ),
    confirmedMatches: tournament.rounds.reduce((acc, round) => 
      acc + round.groups.reduce((groupAcc, group) => 
        groupAcc + group.matches.filter(m => m.isConfirmed).length, 0
      ), 0
    ),
  };

  const serializedTournament = {
    id: tournament.id,
    title: tournament.title,
    startDate: tournament.startDate.toISOString(),
    endDate: tournament.endDate.toISOString(),
    totalRounds: tournament.totalRounds,
    roundDurationDays: tournament.roundDurationDays,
  };

  const serializedRounds = tournament.rounds.map(round => ({
    id: round.id,
    number: round.number,
    startDate: round.startDate.toISOString(),
    endDate: round.endDate.toISOString(),
    isClosed: round.isClosed,
    groupsCount: round.groups.length,
    matchesCount: round.groups.reduce((acc, group) => acc + group.matches.length, 0),
    pendingMatches: round.groups.reduce((acc, group) => 
      acc + group.matches.filter(m => !m.isConfirmed).length, 0
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