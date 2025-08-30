// app/admin/players/manage/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PlayersManager from "../PlayersManager"; // ⬅️ aquí va el manager (no PlayersClient)

type SerializedPlayer = {
  id: string;
  name: string;
  email: string;
  joinedRound: number;
  comodinesUsed: number;
  totalMatches: number;
  currentRound: number;
};

type TournamentDTO = {
  id: string;
  title: string;
  totalRounds: number;
};

export const metadata = {
  title: "Gestión de jugadores | Escalapp (Admin)",
  description: "Alta/baja y gestión de jugadores del torneo activo.",
};

export default async function PlayersManagePage() {
  // 1) Guardia de sesión y rol
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    redirect("/dashboard");
  }

  // 2) Torneo activo
  const tournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    select: { id: true, title: true, totalRounds: true },
  });
  if (!tournament) {
    redirect("/admin/players");
  }

  // 3) Conteo informativo (cuántos ya están en el torneo)
  const currentPlayersCount = await prisma.tournamentPlayer.count({
    where: { tournamentId: tournament.id },
  });

  // 4) Render: pantalla de gestión (crear y añadir jugadores)
  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gestión de jugadores</h1>
        <Link
          href="/admin/players"
          className="text-sm underline text-muted-foreground hover:text-foreground"
        >
          Volver a listado
        </Link>
      </div>

      <PlayersManager
        tournament={tournament}
        currentPlayers={currentPlayersCount}
      />
    </div>
  );
}
