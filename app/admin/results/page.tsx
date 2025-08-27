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

// Tipo ligero para tipar el array que mapeamos (evita implicit-any en 'match')
type MatchPendingDb = {
  id: string;
  group: {
    number: number | null;
    round: {
      number: number | null;
      tournament: { id: string; title?: string | null };
    };
  } | null;
  setNumber: number;
  team1Player1Id: string | null;
  team1Player2Id: string | null;
  team2Player1Id: string | null;
  team2Player2Id: string | null;
  team1Games: number | null;
  team2Games: number | null;
  tiebreakScore: string | null;
  reportedById: string | null;
  photoUrl?: string | null;
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
              tournament: true, // Por si lo necesitas en el cliente
            },
          },
        },
      },
    },
  });

  // Obtener los jugadores por separado ya que no hay relación directa
  const pendingWithPlayers = await Promise.all(
    (pending as MatchPendingDb[]).map(async (match) => {
      const [team1Player1, team1Player2, team2Player1, team2Player2, reportedBy] = await Promise.all([
        match.team1Player1Id
          ? prisma.player.findUnique({ where: { id: match.team1Player1Id }, select: { id: true, name: true } })
          : Promise.resolve(null),
        match.team1Player2Id
          ? prisma.player.findUnique({ where: { id: match.team1Player2Id }, select: { id: true, name: true } })
          : Promise.resolve(null),
        match.team2Player1Id
          ? prisma.player.findUnique({ where: { id: match.team2Player1Id }, select: { id: true, name: true } })
          : Promise.resolve(null),
        match.team2Player2Id
          ? prisma.player.findUnique({ where: { id: match.team2Player2Id }, select: { id: true, name: true } })
          : Promise.resolve(null),
        match.reportedById
          ? prisma.player.findUnique({ where: { id: match.reportedById }, select: { id: true, name: true } })
          : Promise.resolve(null),
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

    // Juegos del set para edición
    team1Games: m.team1Games,
    team2Games: m.team2Games,

    // Tie-break (si procede)
    tiebreakScore: m.tiebreakScore as string | null,

    // Marcador concatenado (opcional)
    score: `${m.team1Games}-${m.team2Games}`,

    team1: [m.team1Player1?.name ?? "—", m.team1Player2?.name ?? "—"],
    team2: [m.team2Player1?.name ?? "—", m.team2Player2?.name ?? "—"],
    reportedBy: m.reportedBy?.name ?? m.reportedBy?.id ?? "—",

    // Foto del acta si existe en tu modelo
    photoUrl: (m.photoUrl as string | null) ?? "",
  };
}
