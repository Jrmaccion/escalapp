"use client";

import { ArrowLeft, Plus, Trophy, Users, Calendar, Settings, Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTransition } from "react";

type SerializedTournament = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  totalRounds: number;
  roundDurationDays: number;
  isActive: boolean;
  isPublic: boolean;
  playersCount: number;
  roundsCount: number;
  status: "active" | "finished" | "upcoming" | "inactive";
};

type TournamentsClientProps = {
  tournaments: SerializedTournament[];
};

export default function TournamentsClient({ tournaments }: TournamentsClientProps) {
  const [isPending, startTransition] = useTransition();
  const activeTournament = tournaments.find((t) => t.isActive);

  const getStatusBadge = (tournament: SerializedTournament) => {
    const baseClasses = "inline-block px-2 py-1 rounded text-xs font-medium";

    switch (tournament.status) {
      case "active":
        return <span className={`${baseClasses} bg-green-100 text-green-700`}>Activo</span>;
      case "finished":
        return <span className={`${baseClasses} bg-gray-100 text-gray-700`}>Finalizado</span>;
      case "upcoming":
        return <span className={`${baseClasses} bg-blue-100 text-blue-700`}>Próximo</span>;
      default:
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-700`}>Inactivo</span>;
    }
  };

  const activateTournament = (tournamentId: string) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}/activate`, {
          method: "PATCH",
        });
        if (res.ok) {
          window.location.reload();
        } else {
          alert("Error al activar torneo");
        }
      } catch (error) {
        alert("Error de conexión");
      }
    });
  };

  const deleteTournament = (tournamentId: string, tournamentTitle: string) => {
    const confirmed = confirm(
      `¿Seguro que quieres eliminar el torneo "${tournamentTitle}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          window.location.reload();
        } else {
          alert("Error al eliminar torneo");
        }
      } catch (error) {
        alert("Error de conexión");
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/admin"
              className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard Admin
            </Link>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Gestión de Torneos</h1>
              <p className="text-gray-600">{tournaments.length} torneos creados</p>
            </div>

            {/* Botón cambiado → ahora redirige a /admin/tournaments/create */}
            <Link href="/admin/tournaments/create">
              <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4 mr-2" />
                Crear Torneo
              </button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Total</h3>
              <Trophy className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold">{tournaments.length}</div>
            <p className="text-xs text-gray-500">torneos creados</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Activos</h3>
              <Calendar className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold">{tournaments.filter((t) => t.status === "active").length}</div>
            <p className="text-xs text-gray-500">en curso</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Finalizados</h3>
              <Trophy className="h-4 w-4 text-gray-600" />
            </div>
            <div className="text-2xl font-bold">{tournaments.filter((t) => t.status === "finished").length}</div>
            <p className="text-xs text-gray-500">completados</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Jugadores</h3>
              <Users className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold">{activeTournament?.playersCount || 0}</div>
            <p className="text-xs text-gray-500">en torneo activo</p>
          </div>
        </div>

        {/* Torneo activo destacado */}
        {activeTournament && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Trophy className="h-6 w-6 text-green-600" />
                  <h2 className="text-xl font-bold text-green-900">Torneo Activo</h2>
                  {getStatusBadge(activeTournament)}
                </div>
                <h3 className="text-lg font-semibold mb-2">{activeTournament.title}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Inicio:</span>
                    <div className="font-medium">
                      {format(new Date(activeTournament.startDate), "d MMM yyyy", { locale: es })}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Fin:</span>
                    <div className="font-medium">
                      {format(new Date(activeTournament.endDate), "d MMM yyyy", { locale: es })}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Jugadores:</span>
                    <div className="font-medium">{activeTournament.playersCount}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Rondas:</span>
                    <div className="font-medium">
                      {activeTournament.roundsCount} / {activeTournament.totalRounds}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/admin/tournaments/${activeTournament.id}`}
                  className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver Detalle
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Lista de torneos */}
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Todos los Torneos</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b bg-gray-50">
                  <th className="py-3 px-6">Torneo</th>
                  <th className="py-3 px-6">Estado</th>
                  <th className="py-3 px-6">Fechas</th>
                  <th className="py-3 px-6">Participantes</th>
                  <th className="py-3 px-6">Progreso</th>
                  <th className="py-3 px-6">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No hay torneos creados aún
                    </td>
                  </tr>
                ) : (
                  tournaments.map((tournament) => (
                    <tr key={tournament.id} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="font-medium">{tournament.title}</div>
                        <div className="text-xs text-gray-500">
                          {tournament.totalRounds} rondas • {tournament.roundDurationDays} días/ronda
                        </div>
                      </td>
                      <td className="py-4 px-6">{getStatusBadge(tournament)}</td>
                      <td className="py-4 px-6 text-xs">
                        <div>{format(new Date(tournament.startDate), "d MMM yyyy", { locale: es })}</div>
                        <div className="text-gray-500">
                          {format(new Date(tournament.endDate), "d MMM yyyy", { locale: es })}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span>{tournament.playersCount}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-xs">
                          {tournament.roundsCount} / {tournament.totalRounds} rondas
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(tournament.roundsCount / tournament.totalRounds) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/tournaments/${tournament.id}`}
                            className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {!tournament.isActive && tournament.status !== "finished" && (
                            <button
                              onClick={() => activateTournament(tournament.id)}
                              disabled={isPending}
                              className="p-1 text-gray-600 hover:text-green-600 transition-colors"
                              title="Activar torneo"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                          )}

                          {tournament.status !== "active" && (
                            <button
                              onClick={() => deleteTournament(tournament.id, tournament.title)}
                              disabled={isPending}
                              className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                              title="Eliminar torneo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
