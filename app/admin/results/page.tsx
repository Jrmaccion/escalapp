import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import ResultsClient from "./ResultsClient";

export const metadata: Metadata = {
  title: "Resultados pendientes | Escalapp",
  description: "Valida resultados reportados por los jugadores",
};

export default async function AdminResultsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  // Trae resultados NO confirmados, con datos útiles para mostrar
  const pending = await prisma.match.findMany({
    where: { isConfirmed: false },
    orderBy: { id: "desc" }, // Usar el ID para ordenar por más recientes
    include: {
      group: { 
        include: { 
          round: {
            include: {
              tournament: true // Para obtener info del torneo si la necesitas
            }
          }
        } 
      },
    },
  });

  // Obtener los jugadores por separado ya que no hay relación directa
  const pendingWithPlayers = await Promise.all(
    pending.map(async (match) => {
      const [team1Player1, team1Player2, team2Player1, team2Player2, reportedBy] = await Promise.all([
        prisma.player.findUnique({ where: { id: match.team1Player1Id } }),
        prisma.player.findUnique({ where: { id: match.team1Player2Id } }),
        prisma.player.findUnique({ where: { id: match.team2Player1Id } }),
        prisma.player.findUnique({ where: { id: match.team2Player2Id } }),
        match.reportedById ? prisma.player.findUnique({ where: { id: match.reportedById } }) : null,
      ]);

      return {
        ...match,
        team1Player1,
        team1Player2,
        team2Player1,
        team2Player2,
        reportedBy,
      };
    })
  );

  // Serializar los datos para pasarlos al Client Component
  const serializedPending = pendingWithPlayers.map(serializeMatch);

  return <ResultsClient pendingMatches={serializedPending} />;
}

// -------- Helpers (Server) --------
function serializeMatch(m: any) {
  return {
    id: m.id,
    roundNumber: m.group?.round?.number ?? "-",
    groupNumber: m.group?.number ?? "-",
    setNumber: m.setNumber,

    // NUEVO: juegos del set para edición
    team1Games: m.team1Games,
    team2Games: m.team2Games,

    // NUEVO: tie-break
    tiebreakScore: m.tiebreakScore as string | null,

    // sigue valiendo si quieres mostrar marcador concatenado
    score: `${m.team1Games}-${m.team2Games}`,

    team1: [m.team1Player1?.name ?? "—", m.team1Player2?.name ?? "—"],
    team2: [m.team2Player1?.name ?? "—", m.team2Player2?.name ?? "—"],
    reportedBy: m.reportedBy?.name ?? m.reportedBy?.id ?? "—",

    // NUEVO: foto del acta (si tu modelo la tiene)
    photoUrl: (m.photoUrl as string | null) ?? "",
  };
}