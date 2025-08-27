import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import PlayersClient from "./PlayersClient";

export const metadata: Metadata = {
  title: "Jugadores | Escalapp",
  description: "Gestión de jugadores del torneo",
};

export default async function AdminPlayersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  // Obtener torneo activo
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
  });

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h1 className="text-2xl font-bold mb-4">No hay torneo activo</h1>
          <p className="text-gray-600">Crea un torneo para gestionar jugadores.</p>
        </div>
      </div>
    );
  }

  // Obtener jugadores del torneo con estadísticas
  const players = await prisma.player.findMany({
    include: {
      user: true,
      tournaments: {
        where: { tournamentId: tournament.id },
        include: {
          tournament: true,
        }
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

  // Filtrar solo jugadores del torneo activo
  const tournamentPlayers = players.filter(player => 
    player.tournaments.some(tp => tp.tournamentId === tournament.id)
  );

  // Serializar datos
  const serializedPlayers = await Promise.all(
    tournamentPlayers.map(async (player) => {
      const tournamentPlayer = player.tournaments.find(tp => tp.tournamentId === tournament.id);
      
      // Calcular estadísticas básicas
      const totalMatches = await prisma.match.count({
        where: {
          OR: [
            { team1Player1Id: player.id },
            { team1Player2Id: player.id },
            { team2Player1Id: player.id },
            { team2Player2Id: player.id },
          ],
          isConfirmed: true,
        },
      });

      const currentRound = await prisma.round.findFirst({
        where: { 
          tournamentId: tournament.id,
          isClosed: false,
        },
        orderBy: { number: "asc" },
      });

      return {
        id: player.id,
        name: player.name,
        email: player.user.email,
        joinedRound: tournamentPlayer?.joinedRound || 1,
        comodinesUsed: tournamentPlayer?.comodinesUsed || 0,
        totalMatches,
        currentRound: currentRound?.number || 0,
      };
    })
  );

  return (
    <PlayersClient 
      players={serializedPlayers}
      tournament={{
        id: tournament.id,
        title: tournament.title,
        totalRounds: tournament.totalRounds,
      }}
    />
  );
}