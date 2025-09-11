// app/admin/tournaments/[id]/players/manage/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PlayersManager from "@/app/admin/players/PlayersManager";

export const metadata = {
  title: "Gestión de jugadores | PadelRise(Admin)",
  description: "Alta/baja y gestión de jugadores por torneo.",
};

export default async function PlayersManageByTournamentPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) redirect("/dashboard");

  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, totalRounds: true },
  });
  if (!tournament) redirect("/admin/tournaments");

  const currentPlayersCount = await prisma.tournamentPlayer.count({
    where: { tournamentId: tournament.id },
  });

  // Para el selector: listar torneos disponibles (solo lo básico)
  const tournaments = await prisma.tournament.findMany({
    select: { id: true, title: true },
    orderBy: { startDate: "desc" },
    take: 50,
  });

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gestión de jugadores</h1>
        <Link href="/admin/players" className="text-sm underline text-muted-foreground hover:text-foreground">
          Volver a listado
        </Link>
      </div>

      {/* Pasamos tournament + contador + lista para selector */}
      <PlayersManager tournament={tournament} currentPlayers={currentPlayersCount} tournaments={tournaments} />
    </div>
  );
}
