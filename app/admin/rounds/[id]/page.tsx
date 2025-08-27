import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import RoundDetailClient from "./RoundDetailClient";

export const metadata: Metadata = {
  title: "Detalle de Ronda | Escalapp",
  description: "Información detallada de la ronda",
};

export default async function RoundDetailPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  // Obtener la ronda específica
  const round = await prisma.round.findUnique({
    where: { id: params.id },
    include: {
      tournament: true,
      groups: {
        include: {
          players: {
            include: {
              player: true,
            }
          },
          matches: {
            orderBy: { setNumber: "asc" },
          }
        }
      }
    }
  });

  if (!round) {
    notFound();
  }

  // Calcular estadísticas de la ronda
  const totalMatches = round.groups.reduce((acc, group) => acc + group.matches.length, 0);
  const confirmedMatches = round.groups.reduce((acc, group) => 
    acc + group.matches.filter(m => m.isConfirmed).length, 0
  );
  const pendingMatches = totalMatches - confirmedMatches;

  // Serializar datos
  const serializedRound = {
    id: round.id,
    number: round.number,
    startDate: round.startDate.toISOString(),
    endDate: round.endDate.toISOString(),
    isClosed: round.isClosed,
    tournament: {
      id: round.tournament.id,
      title: round.tournament.title,
    }
  };

  const serializedGroups = round.groups.map(group => ({
    id: group.id,
    number: group.number,
    level: group.level,
    players: group.players.map(gp => ({
      id: gp.id,
      name: gp.player.name,
      position: gp.position,
      points: gp.points,
      streak: gp.streak,
      usedComodin: gp.usedComodin,
    })),
    matches: group.matches.map(match => ({
      id: match.id,
      setNumber: match.setNumber,
      team1Player1Id: match.team1Player1Id,
      team1Player2Id: match.team1Player2Id,
      team2Player1Id: match.team2Player1Id,
      team2Player2Id: match.team2Player2Id,
      team1Games: match.team1Games,
      team2Games: match.team2Games,
      tiebreakScore: match.tiebreakScore,
      isConfirmed: match.isConfirmed,
      photoUrl: match.photoUrl,
    }))
  }));

  const stats = {
    totalGroups: round.groups.length,
    totalMatches,
    confirmedMatches,
    pendingMatches,
    completionPercentage: totalMatches > 0 ? Math.round((confirmedMatches / totalMatches) * 100) : 0,
  };

  return (
    <RoundDetailClient 
      round={serializedRound}
      groups={serializedGroups}
      stats={stats}
    />
  );
}