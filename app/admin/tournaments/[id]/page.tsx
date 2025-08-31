// app/admin/tournaments/[id]/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import TournamentDetailClient from "./TournamentDetailClient";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

// ===== SEO dinámico =====
export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const t = await prisma.tournament.findUnique({
    where: { id: decodeURIComponent(params.id) },
    select: { title: true },
  });
  return {
    title: t ? `Admin · ${t.title} | Escalapp` : "Torneo no encontrado · Escalapp",
    description: "Panel de administración del torneo",
  };
}

// ===== Helpers =====
const toISO = (d?: Date | null, fallback?: Date) =>
  (d ?? fallback ?? new Date()).toISOString();

type SerializedTournament = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  totalRounds: number;
  roundDurationDays: number;
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

type SerializedRound = {
  id: string;
  number: number;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  groupsCount: number;
  playersCount: number;
  matchesCount: number;
  pendingMatches: number;
};

type SerializedPlayer = {
  id: string;
  name: string;
  email: string;
  joinedRound: number;
  comodinesUsed: number;
};

type Stats = {
  totalPlayers: number;
  totalRounds: number;
  activeRounds: number;
  totalMatches: number;
  confirmedMatches: number;
  pendingMatches: number;
  completionPercentage: number;
  averagePlayersPerRound: number;
};

export default async function Page({ params }: { params: { id: string } }) {
  // ===== Auth / permisos =====
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  const id = decodeURIComponent(params.id);

  // ===== Query TIPADA para incluir relaciones =====
  // Ajusta los includes si tu esquema usa otros nombres.
  const query = {
    where: { id },
    include: {
      players: true, // jugador inscrito al torneo (sin .user)
      rounds: {
        orderBy: { number: "asc" as const },
        include: {
          groups: {
            orderBy: { number: "asc" as const },
            include: {
              players: true, // si tu pivot se llama distinto, cámbialo
              matches: true, // si los partidos cuelgan de la ronda, muévelo arriba
            },
          },
        },
      },
    },
  } as const;

  type TournamentWithDeep = Prisma.TournamentGetPayload<typeof query>;

  const tournament: TournamentWithDeep | null = await prisma.tournament.findUnique(query);

  if (!tournament) {
    // 🔒 Evita acceder a tournament.title en el server
    notFound();
  }

  // ===== Serialización EXACTA para tu client =====
  const serializedTournament: SerializedTournament = {
    id: tournament.id,
    title: tournament.title,
    startDate: toISO(tournament.startDate),
    endDate: toISO(tournament.endDate),
    totalRounds: tournament.totalRounds ?? (tournament.rounds?.length ?? 0),
    roundDurationDays: tournament.roundDurationDays ?? 14,
    isActive: Boolean(tournament.isActive),
    isPublic: Boolean((tournament as any).isPublic ?? false),
    createdAt: toISO(tournament.createdAt),
    updatedAt: toISO(tournament.updatedAt),
  };

  const serializedRounds: SerializedRound[] = (tournament.rounds ?? []).map(
    (r: TournamentWithDeep["rounds"][number]) => {
      const groups = r.groups ?? [];
      const groupsCount = groups.length;

      // Jugadores únicos por ronda (sumando por grupos)
      const playerIds = new Set<string>();
      for (const g of groups) {
        const gp = g.players ?? [];
        for (const p of gp as any[]) {
          // Si tu pivot es { playerId }, usa p.playerId
          playerIds.add(p.playerId ?? p.id);
        }
      }

      // Partidos por ronda (sumando todos los grupos)
      const matches = groups.flatMap((g: any) => g.matches ?? []);
      const matchesCount = matches.length;

      // Confirmados (ajusta según tu campo real)
      const confirmedMatches = matches.filter((m: any) =>
        typeof m.isConfirmed === "boolean"
          ? m.isConfirmed
          : (m.status === "CONFIRMED" || m.confirmedAt)
      ).length;

      const pendingMatches = Math.max(matchesCount - confirmedMatches, 0);

      return {
        id: r.id,
        number: r.number,
        startDate: toISO(r.startDate),
        endDate: toISO(r.endDate),
        isClosed: Boolean(r.isClosed),
        groupsCount,
        playersCount: playerIds.size,
        matchesCount,
        pendingMatches,
      };
    }
  );

  const serializedPlayers: SerializedPlayer[] = (tournament.players ?? []).map((tp: any) => ({
    id: tp.id,
    name: tp.name ?? "Jugador",
    email: tp.email ?? "",
    joinedRound: tp.joinedRound ?? 1,
    comodinesUsed: tp.comodinesUsed ?? 0,
  }));

  // ===== Stats agregadas =====
  const totalPlayers = serializedPlayers.length;
  const totalRounds = serializedRounds.length;
  const activeRounds = serializedRounds.filter((r) => !r.isClosed).length;
  const totalMatches = serializedRounds.reduce((acc, r) => acc + r.matchesCount, 0);
  const confirmedMatches = serializedRounds.reduce(
    (acc, r) => acc + (r.matchesCount - r.pendingMatches),
    0
  );
  const pendingMatches = Math.max(totalMatches - confirmedMatches, 0);
  const completionPercentage = totalMatches > 0 ? (confirmedMatches / totalMatches) * 100 : 0;
  const averagePlayersPerRound =
    totalRounds > 0
      ? serializedRounds.reduce((acc, r) => acc + r.playersCount, 0) / totalRounds
      : 0;

  const stats: Stats = {
    totalPlayers,
    totalRounds,
    activeRounds,
    totalMatches,
    confirmedMatches,
    pendingMatches,
    completionPercentage,
    averagePlayersPerRound,
  };

  // ===== Render: TODO tu UI vive en el Client =====
  return (
    <TournamentDetailClient
      tournament={serializedTournament}
      rounds={serializedRounds}
      players={serializedPlayers}
      stats={stats}
    />
  );
}
