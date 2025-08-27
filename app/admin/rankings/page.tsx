import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import RankingsClient from "./RankingsClient";

export const metadata: Metadata = {
  title: "Rankings | Escalapp",
  description: "Clasificaciones y ranking del torneo",
};

export default async function AdminRankingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  // Obtener torneo activo
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    include: {
      rounds: {
        orderBy: { number: "desc" },
      },
    },
  });

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="text-2xl font-bold mb-4">No hay torneo activo</h1>
          <p className="text-gray-600">Crea un torneo para ver los rankings.</p>
        </div>
      </div>
    );
  }

  // Obtener la ronda más reciente con datos
  const latestRound = tournament.rounds[0];
  
  // Obtener rankings de la tabla Ranking
  const rankings = await prisma.ranking.findMany({
    where: { 
      tournamentId: tournament.id,
      roundNumber: latestRound?.number || 1,
    },
    orderBy: [
      { position: "asc" },
    ],
  });

  // Si no hay rankings en la tabla, calculamos manualmente
  let playersWithStats = [];
  
  if (rankings.length === 0) {
    // Calcular estadísticas manualmente
    const players = await prisma.player.findMany({
      include: {
        tournaments: {
          where: { tournamentId: tournament.id },
        },
        groupPlayers: {
          include: {
            group: {
              include: {
                round: true,
              }
            }
          }
        },
      },
    });

    const tournamentPlayers = players.filter(player => 
      player.tournaments.some(tp => tp.tournamentId === tournament.id)
    );

    playersWithStats = await Promise.all(
      tournamentPlayers.map(async (player, index) => {
        // Contar partidos jugados y puntos
        const matchesAsTeam1Player1 = await prisma.match.count({
          where: { team1Player1Id: player.id, isConfirmed: true }
        });
        const matchesAsTeam1Player2 = await prisma.match.count({
          where: { team1Player2Id: player.id, isConfirmed: true }
        });
        const matchesAsTeam2Player1 = await prisma.match.count({
          where: { team2Player1Id: player.id, isConfirmed: true }
        });
        const matchesAsTeam2Player2 = await prisma.match.count({
          where: { team2Player2Id: player.id, isConfirmed: true }
        });

        const totalMatches = matchesAsTeam1Player1 + matchesAsTeam1Player2 + matchesAsTeam2Player1 + matchesAsTeam2Player2;
        
        // Calcular puntos aproximados (esto dependería de tu lógica específica)
        const totalPoints = player.groupPlayers.reduce((acc, gp) => acc + gp.points, 0);
        const averagePoints = totalMatches > 0 ? totalPoints / totalMatches : 0;

        return {
          playerId: player.id,
          playerName: player.name,
          position: index + 1,
          totalPoints,
          roundsPlayed: player.groupPlayers.length,
          averagePoints,
          ironmanPosition: index + 1,
          movement: "stable" as const,
        };
      })
    );

    // Ordenar por puntos totales
    playersWithStats.sort((a, b) => b.totalPoints - a.totalPoints);
    playersWithStats = playersWithStats.map((player, index) => ({
      ...player,
      position: index + 1,
    }));
  } else {
    // Usar datos de la tabla Ranking
    playersWithStats = await Promise.all(
      rankings.map(async (ranking) => {
        const player = await prisma.player.findUnique({
          where: { id: ranking.playerId },
        });
        
        return {
          playerId: ranking.playerId,
          playerName: player?.name || "Jugador desconocido",
          position: ranking.position,
          totalPoints: ranking.totalPoints,
          roundsPlayed: ranking.roundsPlayed,
          averagePoints: ranking.averagePoints,
          ironmanPosition: ranking.ironmanPosition,
          movement: ranking.movement as "up" | "down" | "stable" | "new",
        };
      })
    );
  }

  const serializedTournament = {
    id: tournament.id,
    title: tournament.title,
    currentRound: latestRound?.number || 1,
    totalRounds: tournament.totalRounds,
  };

  return (
    <RankingsClient 
      rankings={playersWithStats}
      tournament={serializedTournament}
    />
  );
}