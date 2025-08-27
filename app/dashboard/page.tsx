import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, TrendingUp, Calendar, AlertCircle, Settings } from "lucide-react";

export const metadata = {
  title: "Panel de Jugador | Escalapp",
  description: "Tu espacio personal en Escalapp",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  // Buscar torneo activo
  const activeTournament = await prisma.tournament.findFirst({
    where: { isActive: true },
    include: {
      rounds: {
        orderBy: { number: "desc" },
        take: 1,
        include: {
          groups: {
            include: {
              players: {
                where: {
                  player: {
                    user: {
                      id: session.user.id
                    }
                  }
                },
                include: {
                  player: true,
                  group: true
                }
              }
            }
          }
        }
      },
      players: {
        where: {
          player: {
            user: {
              id: session.user.id
            }
          }
        },
        include: {
          player: true
        }
      }
    }
  });

  const userPlayer = activeTournament?.players[0];
  const currentRound = activeTournament?.rounds[0];
  const userGroupPlayer = currentRound?.groups
    .flatMap(g => g.players)
    .find(gp => gp.player.userId === session.user.id);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Hola, {session.user?.name ?? session.user?.email}
          </h1>
          {activeTournament && (
            <p className="text-gray-600">
              Participando en: <span className="font-semibold">{activeTournament.title}</span>
            </p>
          )}
        </div>

        {!activeTournament ? (
          // No hay torneo activo
          <div className="text-center py-20">
            <AlertCircle className="h-16 w-16 mx-auto mb-6 text-gray-400" />
            <h2 className="text-2xl font-bold mb-4">No hay torneo activo</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Actualmente no hay ningún torneo en curso. Mantente atento para participar en el próximo torneo.
            </p>
            
            {session.user?.isAdmin && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
                <h3 className="font-semibold text-blue-900 mb-2">Panel de Administrador</h3>
                <p className="text-blue-700 text-sm mb-4">
                  Como administrador, puedes crear y gestionar torneos
                </p>
                <a 
                  href="/admin/tournaments"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Gestionar Torneos
                </a>
              </div>
            )}
          </div>
        ) : (
          // Hay torneo activo
          <div>
            <div className="grid gap-6 md:grid-cols-3 mb-8">
              <Card>
                <CardHeader>
                  <Trophy className="w-6 h-6 text-yellow-500 mb-2" />
                  <CardTitle>Mi Posición</CardTitle>
                </CardHeader>
                <CardContent>
                  {userGroupPlayer ? (
                    <div>
                      <p className="text-2xl font-bold">
                        Grupo {userGroupPlayer.group.number} - Pos. {userGroupPlayer.position}
                      </p>
                      <p className="text-sm text-gray-600">
                        {userGroupPlayer.points.toFixed(1)} puntos
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg">No asignado</p>
                      <p className="text-sm text-gray-600">Esperando ronda</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Users className="w-6 h-6 text-blue-600 mb-2" />
                  <CardTitle>Estado Torneo</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">{activeTournament.title}</p>
                  <p className="text-sm text-gray-600">
                    {currentRound ? `Ronda ${currentRound.number}` : 'Preparando rondas'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <TrendingUp className="w-6 h-6 text-green-600 mb-2" />
                  <CardTitle>Mi Progreso</CardTitle>
                </CardHeader>
                <CardContent>
                  {userPlayer ? (
                    <div>
                      <p className="text-2xl font-bold">
                        {userPlayer.comodinesUsed} comodines
                      </p>
                      <p className="text-sm text-gray-600">
                        Desde ronda {userPlayer.joinedRound}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg">No inscrito</p>
                      <p className="text-sm text-gray-600">Contacta al admin</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Información adicional */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Próximos Partidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Los partidos se programan automáticamente al inicio de cada ronda.
                  </p>
                  <a 
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 underline"
                    href="/matches"
                  >
                    <Calendar className="w-4 h-4 mr-1" />
                    Ver mis partidos
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Accesos Rápidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <a className="text-blue-600 hover:text-blue-800 underline" href="/rankings">
                        Ver ranking general
                      </a>
                    </li>
                    <li>
                      <a className="text-blue-600 hover:text-blue-800 underline" href="/profile">
                        Editar mi perfil
                      </a>
                    </li>
                    {session.user?.isAdmin && (
                      <li>
                        <a className="text-purple-600 hover:text-purple-800 underline" href="/admin">
                          Panel de administrador
                        </a>
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}