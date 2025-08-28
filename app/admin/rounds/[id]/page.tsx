import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import RoundDetailClient from "./RoundDetailClient";

export const metadata: Metadata = {
  title: "Detalle de Ronda | Escalapp",
  description: "Información detallada de la ronda",
};

export default async function RoundDetailPage({
  params,
}: {
  params: { id: string };
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
            },
          },
          matches: {
            orderBy: { setNumber: "asc" },
          },
        },
      },
    },
  });

  if (!round) {
    notFound();
  }

  // ---- Calcular estadísticas (sin reduce implícito) ----
  type MatchLite = { isConfirmed?: boolean | null };
  type GroupLite = { matches: MatchLite[] };

  const groupsArr = round.groups as unknown as GroupLite[];

  let totalMatches = 0;
  let confirmedMatches = 0;

  for (const g of groupsArr) {
    const matches = (g.matches ?? []) as MatchLite[];
    totalMatches += matches.length;
    for (const m of matches) {
      if (m && !!m.isConfirmed) confirmedMatches++;
    }
  }

  const pendingMatches = totalMatches - confirmedMatches;

  // ---- Serialización ----
  const serializedRound = {
    id: round.id,
    number: round.number,
    startDate: round.startDate.toISOString(),
    endDate: round.endDate ? round.endDate.toISOString() : "",
    isClosed: round.isClosed,
    tournament: {
      id: round.tournament.id,
      title: round.tournament.title,
    },
  };

  const serializedGroups = round.groups.map((group) => ({
    id: group.id,
    number: group.number,
    level: group.level,
    players: group.players.map((gp) => ({
      id: gp.id,
      name: gp.player.name,
      position: gp.position,
      points: gp.points,
      streak: gp.streak,
      // Si existe en tu esquema, se respeta; si no, false sin romper tipos:
      usedComodin: (gp as any)?.usedComodin ?? false,
    })),
    matches: group.matches.map((match) => ({
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
      photoUrl: (match as any).photoUrl ?? null,
    })),
  }));

  const stats = {
    totalGroups: round.groups.length,
    totalMatches,
    confirmedMatches,
    pendingMatches,
    completionPercentage:
      totalMatches > 0 ? Math.round((confirmedMatches / totalMatches) * 100) : 0,
  };

  return (
    <RoundDetailClient round={serializedRound} groups={serializedGroups} stats={stats} />
  );
}
