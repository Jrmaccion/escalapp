import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import PlayersClient from "./PlayersClient";

export const metadata: Metadata = {
  title: "Jugadores | Escalapp",
  description: "Gestión de jugadores del torneo",
};

// Tipos internos (nombres únicos para evitar choques con tipos del cliente)
type TPLink = {
  tournamentId: string;
  joinedRound: number | null;
  comodinesUsed: number | null;
};

type PlayerRowDb = {
  id: string;
  name: string;
  user: { email: string | null } | null;
  tournaments: TPLink[];
  groupPlayers: {
    group: {
      round: { id: string; number: number; tournamentId: string };
    };
  }[];
};

type PlayerRowClient = {
  id: string;
  name: string;
  email: string; // <-- siempre string
  joinedRound: number;
  comodinesUsed: number;
  totalMatches: number;
  currentRound: number;
};

export default async function AdminPlayersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  // Torneo activo
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    select: { id: true, title: true, totalRounds: true },
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

  // Jugadores con usuario, links a torneos y relación con grupos/rondas
  const players = (await prisma.player.findMany({
    include: {
      user: { select: { email: true } },
      tournaments: {
        where: { tournamentId: tournament.id },
        select: { tournamentId: true, joinedRound: true, comodinesUsed: true },
      },
      groupPlayers: {
        include: {
          group: { include: { round: { select: { id: true, number: true, tournamentId: true } } } },
        },
      },
    },
    orderBy: { name: "asc" },
  })) as unknown as PlayerRowDb[];

  // Current round del torneo (una sola consulta)
  const currentRound = await prisma.round.findFirst({
    where: { tournamentId: tournament.id, isClosed: false },
    orderBy: { number: "asc" },
    select: { number: true },
  });
  const currentRoundNumber = currentRound?.number ?? 0;

  // Filtrar solo jugadores inscritos en el torneo activo
  const tournamentPlayers: PlayerRowDb[] = players.filter((p) =>
    p.tournaments.some((tp) => tp.tournamentId === tournament.id)
  );

  // Serializar: email siempre string
  const serializedPlayers: PlayerRowClient[] = await Promise.all(
    tournamentPlayers.map(async (p) => {
      const tp = p.tournaments.find((t) => t.tournamentId === tournament.id) || {
        joinedRound: 1,
        comodinesUsed: 0,
      };

      const totalMatches = await prisma.match.count({
        where: {
          isConfirmed: true,
          OR: [
            { team1Player1Id: p.id },
            { team1Player2Id: p.id },
            { team2Player1Id: p.id },
            { team2Player2Id: p.id },
          ],
          group: { round: { tournamentId: tournament.id } },
        },
      });

      return {
        id: p.id,
        name: p.name,
        email: p.user?.email ?? "", // <-- fuerza string
        joinedRound: tp.joinedRound ?? 1,
        comodinesUsed: tp.comodinesUsed ?? 0,
        totalMatches,
        currentRound: currentRoundNumber,
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
