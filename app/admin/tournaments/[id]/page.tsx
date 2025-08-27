import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import TournamentDetailClient from "./TournamentDetailClient";

export const metadata: Metadata = {
  title: "Detalle de Torneo | Escalapp",
  description: "Información detallada del torneo",
};

export default async function TournamentDetailPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  // Obtener el torneo específico con todas sus relaciones
  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: {
      rounds: {
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
          }
        }
      },
      players: {
        include: {
          player: {
            include: {
              user: true
            }
          }
        }
      }
    }
  });

  if (!tournament) {
    notFound();
  }

  // Calcular estadísticas del torneo
  const totalMatches = tournament.rounds.reduce((acc, round) => 
    acc + round.groups.reduce((groupAcc, group) => groupAcc + group.matches.length, 0), 0
  );
  
  const confirmedMatches = tournament.rounds.reduce((acc, round) => 
    acc + round.groups.reduce((groupAcc, group) => 
      groupAcc + group.matches.filter(m => m.isConfirmed).length, 0
    ), 0
  );

  const pendingMatches = totalMatches - confirmedMatches;

  // Serializar datos
  const serializedTournament = {
    id: tournament.id,
    title: tournament.title,
    startDate: tournament.startDate.toISOString(),
    endDate: tournament.endDate.toISOString(),
    totalRounds: tournament.totalRounds,
    roundDurationDays: tournament.roundDurationDays,
    isActive: tournament.isActive,
    isPublic: tournament.isPublic,
    createdAt: tournament.createdAt.toISOString(),
    updatedAt: tournament.updatedAt.toISOString(),
  };

  const serializedRounds = tournament.rounds.map(round => ({
    id: round.id,
    number: round.number,
    startDate: round.startDate.toISOString(),
    endDate: round.endDate.toISOString(),
    isClosed: round.isClosed,
    groupsCount: round.groups.length,
    playersCount: round.groups.reduce((acc, group) => acc + group.players.length, 0),
    matchesCount: round.groups.reduce((acc, group) => acc + group.matches.length, 0),
    pendingMatches: round.groups.reduce((acc, group) => 
      acc + group.matches.filter(m => !m.isConfirmed).length, 0
    ),
  }));

  const serializedPlayers = tournament.players.map(tp => ({
    id: tp.player.id,
    name: tp.player.name,
    email: tp.player.user.email,
    joinedRound: tp.joinedRound,
    comodinesUsed: tp.comodinesUsed,
  }));

  const stats = {
    totalPlayers: tournament.players.length,
    totalRounds: tournament.rounds.length,
    activeRounds: tournament.rounds.filter(r => !r.isClosed).length,
    totalMatches,
    confirmedMatches,
    pendingMatches,
    completionPercentage: totalMatches > 0 ? Math.round((confirmedMatches / totalMatches) * 100) : 0,
    averagePlayersPerRound: tournament.rounds.length > 0 
      ? tournament.rounds.reduce((acc, round) => 
          acc + round.groups.reduce((groupAcc, group) => groupAcc + group.players.length, 0), 0
        ) / tournament.rounds.length 
      : 0,
  };

  return (
    <TournamentDetailClient 
      tournament={serializedTournament}
      rounds={serializedRounds}
      players={serializedPlayers}
      stats={stats}
    />
  );
}