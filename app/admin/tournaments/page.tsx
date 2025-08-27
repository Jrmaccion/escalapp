import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import TournamentsClient from "./TournamentsClient";

export const metadata: Metadata = {
  title: "Torneos | Escalapp",
  description: "Gestión de torneos",
};

export default async function AdminTournamentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  // Obtener todos los torneos
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startDate: "desc" },
    include: {
      rounds: true,
      players: {
        include: {
          player: true,
        }
      }
    }
  });

  // Serializar datos para el cliente
  const serializedTournaments = tournaments.map(tournament => ({
  id: tournament.id,
  title: tournament.title,
  startDate: tournament.startDate.toISOString(),
  endDate: tournament.endDate.toISOString(),
  totalRounds: tournament.totalRounds,
  roundDurationDays: tournament.roundDurationDays,
  isActive: tournament.isActive,
  isPublic: tournament.isPublic,
  playersCount: tournament.players.length,
  roundsCount: tournament.rounds.length,
  status: tournament.isActive ? 'active' as const : 
           new Date() > tournament.endDate ? 'finished' as const : 
           new Date() < tournament.startDate ? 'upcoming' as const : 'inactive' as const
}));

  return <TournamentsClient tournaments={serializedTournaments} />;
}