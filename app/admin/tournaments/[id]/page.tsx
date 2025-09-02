// app/admin/tournaments/[id]/page.tsx - VERSIÓN CON TIPOS CORREGIDOS
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Metadata } from "next";
import TournamentDetailClient from "./TournamentDetailClient";

export const metadata: Metadata = {
  title: "Detalle de Torneo | Escalapp",
  description: "Gestión completa del torneo",
};

// Definir tipos específicos para evitar errores de TypeScript
type TournamentWithFullData = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  totalRounds: number;
  roundDurationDays: number;
  isActive: boolean;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  rounds: Array<{
    id: string;
    number: number;
    startDate: Date;
    endDate: Date;
    isClosed: boolean;
    groups: Array<{
      id: string;
      number: number;
      level: number;
      players: Array<{
        position: number;
        player: {
          id: string;
          name: string;
        };
      }>;
      matches: Array<{
        id: string;
        setNumber: number;
        isConfirmed: boolean;
        team1Games: number | null;
        team2Games: number | null;
        tiebreakScore: string | null;
      }>;
    }>;
  }>;
  players: Array<{
    joinedRound: number;
    comodinesUsed: number;
    player: {
      id: string;
      name: string;
      user: {
        email: string;
      };
    };
  }>;
};

async function getTournamentWithCompleteData(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      rounds: {
        include: {
          groups: {
            include: {
              players: {
                include: {
                  player: { 
                    select: { 
                      id: true, 
                      name: true,
                      user: { select: { email: true } }
                    } 
                  }
                },
                orderBy: { position: 'asc' }
              },
              matches: {
                select: {
                  id: true,
                  setNumber: true,
                  isConfirmed: true,
                  team1Games: true,
                  team2Games: true,
                  tiebreakScore: true
                },
                orderBy: { setNumber: 'asc' }
              }
            },
            orderBy: { number: 'asc' }
          }
        },
        orderBy: { number: 'asc' }
      },
      players: {
        include: {
          player: { 
            select: { 
              id: true, 
              name: true,
              user: { select: { email: true } }
            } 
          }
        },
        orderBy: { joinedRound: 'asc' }
      }
    }
  }) as TournamentWithFullData | null;

  if (!tournament) return null;

  // Calcular estadísticas con tipos explícitos
  const totalMatches = tournament.rounds.reduce((acc: number, round) => 
    acc + round.groups.reduce((groupAcc: number, group) => 
      groupAcc + group.matches.length, 0
    ), 0
  );

  const confirmedMatches = tournament.rounds.reduce((acc: number, round) => 
    acc + round.groups.reduce((groupAcc: number, group) => 
      groupAcc + group.matches.filter(m => m.isConfirmed).length, 0
    ), 0
  );

  const pendingMatches = totalMatches - confirmedMatches;
  const activeRounds = tournament.rounds.filter(r => !r.isClosed).length;

  return {
    tournament: {
      id: tournament.id,
      title: tournament.title,
      startDate: tournament.startDate.toISOString(),
      endDate: tournament.endDate.toISOString(),
      totalRounds: tournament.totalRounds,
      roundDurationDays: tournament.roundDurationDays,
      isActive: tournament.isActive,
      isPublic: tournament.isPublic,
      totalPlayers: tournament.players.length,
      createdAt: tournament.createdAt.toISOString(),
      updatedAt: tournament.updatedAt.toISOString(),
    },
    rounds: tournament.rounds.map(round => ({
      id: round.id,
      number: round.number,
      startDate: round.startDate.toISOString(),
      endDate: round.endDate.toISOString(),
      isClosed: round.isClosed,
      groupsCount: round.groups.length,
      playersCount: round.groups.reduce((acc: number, g) => acc + g.players.length, 0),
      matchesCount: round.groups.reduce((acc: number, g) => acc + g.matches.length, 0),
      pendingMatches: round.groups.reduce((acc: number, g) => 
        acc + g.matches.filter(m => !m.isConfirmed).length, 0
      ),
      // ✅ GRUPOS COMPLETOS CON TIPOS CORRECTOS
      groups: round.groups.map(group => ({
        id: group.id,
        number: group.number,
        level: group.level,
        players: group.players.map(gp => ({
          id: gp.player.id,
          name: gp.player.name,
          position: gp.position
        }))
      }))
    })),
    players: tournament.players.map(tp => ({
      id: tp.player.id,
      name: tp.player.name,
      email: tp.player.user.email,
      joinedRound: tp.joinedRound,
      comodinesUsed: tp.comodinesUsed
    })),
    stats: {
      totalPlayers: tournament.players.length,
      totalRounds: tournament.totalRounds,
      activeRounds,
      totalMatches,
      confirmedMatches,
      pendingMatches,
      completionPercentage: totalMatches > 0 ? (confirmedMatches / totalMatches) * 100 : 0,
      averagePlayersPerRound: tournament.rounds.length > 0 
        ? tournament.rounds.reduce((acc: number, r) => 
            acc + r.groups.reduce((ga: number, g) => ga + g.players.length, 0), 0
          ) / tournament.rounds.length 
        : 0
    }
  };
}

export default async function TournamentDetailPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  const data = await getTournamentWithCompleteData(params.id);
  if (!data) notFound();

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <a 
            href="/admin/tournaments" 
            className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Volver a Torneos
          </a>
        </div>
        
        <h1 className="text-3xl font-bold mb-2">{data.tournament.title}</h1>
        <div className="text-gray-600 text-sm">
          {new Date(data.tournament.startDate).toLocaleDateString()} - {new Date(data.tournament.endDate).toLocaleDateString()}
        </div>
      </div>

      <TournamentDetailClient 
        tournament={data.tournament}
        rounds={data.rounds}
        players={data.players}
        stats={data.stats}
      />
    </div>
  );
}