import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Breadcrumbs from "@/components/Breadcrumbs";
import RoundsMatchesOverview from "@/components/RoundsMatchesOverview";
import MatchGenerationPanel from "@/components/MatchGenerationPanel";
import GroupManagementPanel from "@/components/GroupManagementPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, CheckCircle, Clock, ArrowLeft } from "lucide-react";
import { format, differenceInDays, isAfter, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

type RoundDetailPageProps = {
  params: {
    id: string;
  };
};

export const metadata = {
  title: "Detalle de Ronda | Escalapp",
  description: "Vista detallada de la ronda con todos los partidos y programación",
};

async function getRoundData(roundId: string) {
  try {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: {
          select: { id: true, title: true }
        },
        groups: {
          include: {
            players: {
              include: {
                player: {
                  select: { id: true, name: true }
                }
              },
              orderBy: { position: 'asc' }
            },
            matches: {
              include: {
                proposer: {
                  select: { name: true }
                }
              },
              orderBy: { setNumber: 'asc' }
            }
          },
          orderBy: { number: 'asc' }
        }
      }
    });

    return round;
  } catch (error) {
    console.error("Error fetching round data:", error);
    return null;
  }
}

export default async function RoundDetailPage({ params }: RoundDetailPageProps) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }
  
  if (!session.user?.isAdmin) {
    redirect("/dashboard");
  }

  const round = await getRoundData(params.id);
  
  if (!round) {
    notFound();
  }

  // Calcular estadísticas
  const now = new Date();
  const daysToEnd = differenceInDays(round.endDate, now);
  const daysToStart = differenceInDays(round.startDate, now);
  
  const status = round.isClosed 
    ? "closed"
    : isBefore(now, round.startDate)
    ? "upcoming"
    : isAfter(now, round.endDate)
    ? "overdue"
    : "active";

  const totalMatches = round.groups.reduce((acc, group) => acc + group.matches.length, 0);
  const completedMatches = round.groups.reduce((acc, group) => 
    acc + group.matches.filter(m => m.isConfirmed).length, 0
  );
  const scheduledMatches = round.groups.reduce((acc, group) => 
    acc + group.matches.filter(m => m.status === 'SCHEDULED').length, 0
  );

  // Breadcrumbs personalizados
  const breadcrumbItems = [
    { label: 'Inicio', href: '/dashboard' },
    { label: 'Admin', href: '/admin' },
    { label: 'Rondas', href: '/admin/rounds' },
    { label: `Ronda ${round.number}`, current: true }
  ];

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      
      {/* Header con navegación */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">
            Ronda {round.number} - {round.tournament.title}
          </h1>
          <p className="text-gray-600">
            {format(round.startDate, "d 'de' MMMM", { locale: es })} - {" "}
            {format(round.endDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/admin/rounds">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Rondas
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/admin/tournaments/${round.tournament.id}`}>
              Ver Torneo
            </Link>
          </Button>
        </div>
      </div>

      {/* Estado de la ronda */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Estado</span>
              </div>
              <div>
                {status === "closed" && (
                  <Badge className="bg-gray-200 text-gray-800">Cerrada</Badge>
                )}
                {status === "upcoming" && (
                  <Badge className="bg-blue-100 text-blue-700">
                    Próxima ({daysToStart} días)
                  </Badge>
                )}
                {status === "active" && (
                  <Badge className="bg-green-100 text-green-700">
                    Activa ({daysToEnd} días restantes)
                  </Badge>
                )}
                {status === "overdue" && (
                  <Badge variant="destructive">Fuera de plazo</Badge>
                )}
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="w-5 h-5 text-purple-600" />
                <span className="font-medium">Grupos</span>
              </div>
              <div className="text-2xl font-bold">{round.groups.length}</div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium">Completados</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {completedMatches}/{totalMatches}
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Programados</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{scheduledMatches}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas importantes */}
      {status === "overdue" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-red-600" />
            <span className="font-medium text-red-900">Ronda fuera de plazo</span>
          </div>
          <p className="text-red-700 text-sm mt-1">
            Esta ronda terminó el {format(round.endDate, "d 'de' MMMM", { locale: es })}. 
            Considera cerrarla para aplicar movimientos y generar la siguiente ronda.
          </p>
        </div>
      )}

      {daysToEnd <= 3 && daysToEnd > 0 && status === "active" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span className="font-medium text-yellow-900">
              {daysToEnd === 1 ? "Último día" : `${daysToEnd} días restantes`}
            </span>
          </div>
          <p className="text-yellow-700 text-sm mt-1">
            La ronda termina pronto. Asegúrate de que todos los partidos estén programados.
          </p>
        </div>
      )}

      {/* Panel de gestión de grupos */}
      <GroupManagementPanel 
        roundId={params.id}
        roundNumber={round.number}
        tournament={{
          id: round.tournament.id,
          title: round.tournament.title,
          totalPlayers: 0 // Se calculará dinámicamente
        }}
        groups={round.groups.map(group => ({
          id: group.id,
          number: group.number,
          level: group.level,
          players: group.players.map(gp => ({
            id: gp.player.id,
            name: gp.player.name,
            position: gp.position
          }))
        }))}
        availablePlayers={round.groups.reduce((acc, group) => acc + group.players.length, 0)}
        isAdmin={true}
      />

      {/* Panel de generación de partidos */}
      <MatchGenerationPanel 
        roundId={params.id}
        groups={round.groups.map(group => ({
          id: group.id,
          number: group.number,
          level: group.level,
          players: group.players.map(gp => ({
            id: gp.player.id,
            name: gp.player.name,
            position: gp.position
          })),
          matches: group.matches.map(match => ({
            id: match.id,
            setNumber: match.setNumber
          }))
        }))}
        isAdmin={true}
      />

      {/* Vista global de partidos con generación */}
      <RoundsMatchesOverview roundId={params.id} isAdmin={true} />

      {/* Acciones de administración */}
      {!round.isClosed && (
        <Card>
          <CardHeader>
            <CardTitle>Acciones de Administración</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link href="/admin/results">
                  Validar Resultados
                </Link>
              </Button>
              
              <Button variant="outline" asChild>
                <Link href={`/admin/rounds/${round.id}/close`}>
                  Cerrar Ronda
                </Link>
              </Button>
              
              <Button variant="outline" asChild>
                <Link href="/admin/players">
                  Gestionar Jugadores
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}