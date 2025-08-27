"use client";

import { 
  ArrowLeft, 
  Trophy, 
  Calendar, 
  Users, 
  Settings, 
  CheckCircle, 
  Clock, 
  Play,
  Edit,
  Trash2,
  Power,
  Download,
  UserPlus
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useTransition } from "react";

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

type TournamentDetailClientProps = {
  tournament: SerializedTournament;
  rounds: SerializedRound[];
  players: SerializedPlayer[];
  stats: Stats;
};

export default function TournamentDetailClient({ 
  tournament, 
  rounds, 
  players, 
  stats 
}: TournamentDetailClientProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<'overview' | 'rounds' | 'players'>('overview');

  const currentRound = rounds.find(r => !r.isClosed) || rounds[rounds.length - 1];
  const isCurrentDate = (startDate: string, endDate: string) => {
    const now = new Date();
    return now >= new Date(startDate) && now <= new Date(endDate);
  };

  const toggleTournamentStatus = () => {
    const action = tournament.isActive ? 'desactivar' : 'activar';
    const confirmed = confirm(`¿Seguro que quieres ${action} este torneo?`);
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const endpoint = tournament.isActive 
          ? `/api/tournaments/${tournament.id}/deactivate` 
          : `/api/tournaments/${tournament.id}/activate`;
        
        const res = await fetch(endpoint, { method: "PATCH" });
        if (res.ok) {
          window.location.reload();
        } else {
          alert(`Error al ${action} torneo`);
        }
      } catch (error) {
        alert("Error de conexión");
      }
    });
  };

  const deleteTournament = () => {
    const confirmed = confirm(`¿Seguro que quieres eliminar "${tournament.title}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournament.id}`, { method: "DELETE" });
        if (res.ok) {
          window.location.href = '/admin/tournaments';
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
            <Link href="/admin/tournaments" className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Torneos
            </Link>
            <Link href="/admin" className="inline-flex items-center px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
              Dashboard Admin
            </Link>
          </div>
          
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Trophy className="h-8 w-8 text-blue-600" />
                <h1 className="text-3xl font-bold">{tournament.title}</h1>
                <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                  tournament.isActive 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {tournament.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Inicio: {format(new Date(tournament.startDate), "d MMM yyyy", { locale: es })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Fin: {format(new Date(tournament.endDate), "d MMM yyyy", { locale: es })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>{tournament.totalRounds} rondas • {tournament.roundDurationDays} días/ronda</span>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTournamentStatus}
                disabled={isPending}
                className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  tournament.isActive
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                <Power className="w-4 h-4 mr-2" />
                {tournament.isActive ? 'Desactivar' : 'Activar'}
              </button>
              
              {!tournament.isActive && (
                <button
                  onClick={deleteTournament}
                  disabled={isPending}
                  className="inline-flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Jugadores</h3>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold">{stats.totalPlayers}</div>
            <p className="text-xs text-gray-500">registrados</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Progreso</h3>
              <Trophy className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold">{stats.completionPercentage}%</div>
            <p className="text-xs text-gray-500">{stats.confirmedMatches} / {stats.totalMatches} partidos</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Rondas</h3>
              <Play className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold">{stats.totalRounds}</div>
            <p className="text-xs text-gray-500">{stats.activeRounds} activas</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Pendientes</h3>
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
            <div className="text-2xl font-bold">{stats.pendingMatches}</div>
            <p className="text-xs text-gray-500">por validar</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow border">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Resumen', icon: Trophy },
                { id: 'rounds', label: 'Rondas', icon: Calendar },
                { id: 'players', label: 'Jugadores', icon: Users },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Ronda actual */}
                {currentRound && (
                  <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Play className="h-5 w-5 text-blue-600" />
                      Ronda Actual: Ronda {currentRound.number}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Estado:</span>
                        <div className="font-medium">
                          {isCurrentDate(currentRound.startDate, currentRound.endDate) ? 'En curso' : 
                           currentRound.isClosed ? 'Cerrada' : 'Próxima'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-600">Grupos:</span>
                        <div className="font-medium">{currentRound.groupsCount}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Partidos:</span>
                        <div className="font-medium">{currentRound.matchesCount}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Pendientes:</span>
                        <div className="font-medium text-orange-600">{currentRound.pendingMatches}</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Link 
                        href={`/admin/rounds/${currentRound.id}`}
                        className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Ver detalle de ronda
                      </Link>
                    </div>
                  </div>
                )}

                {/* Información del torneo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Configuración</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Rondas totales:</span>
                        <span className="font-medium">{tournament.totalRounds}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Duración por ronda:</span>
                        <span className="font-medium">{tournament.roundDurationDays} días</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Público:</span>
                        <span className="font-medium">{tournament.isPublic ? 'Sí' : 'No'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Creado:</span>
                        <span className="font-medium">{format(new Date(tournament.createdAt), "d MMM yyyy", { locale: es })}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Estadísticas</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Promedio jugadores/ronda:</span>
                        <span className="font-medium">{Math.round(stats.averagePlayersPerRound)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total partidos:</span>
                        <span className="font-medium">{stats.totalMatches}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Partidos confirmados:</span>
                        <span className="font-medium text-green-600">{stats.confirmedMatches}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Partidos pendientes:</span>
                        <span className="font-medium text-orange-600">{stats.pendingMatches}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'rounds' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2">Ronda</th>
                      <th className="py-2">Estado</th>
                      <th className="py-2">Fechas</th>
                      <th className="py-2">Grupos</th>
                      <th className="py-2">Partidos</th>
                      <th className="py-2">Pendientes</th>
                      <th className="py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rounds.map((round) => (
                      <tr key={round.id} className="border-b">
                        <td className="py-3 font-medium">Ronda {round.number}</td>
                        <td className="py-3">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            round.isClosed ? 'bg-gray-100 text-gray-700' :
                            isCurrentDate(round.startDate, round.endDate) ? 'bg-green-100 text-green-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {round.isClosed ? 'Cerrada' : 
                             isCurrentDate(round.startDate, round.endDate) ? 'En curso' : 'Próxima'}
                          </span>
                        </td>
                        <td className="py-3 text-xs">
                          <div>{format(new Date(round.startDate), "d MMM", { locale: es })}</div>
                          <div className="text-gray-500">{format(new Date(round.endDate), "d MMM", { locale: es })}</div>
                        </td>
                        <td className="py-3">{round.groupsCount}</td>
                        <td className="py-3">{round.matchesCount}</td>
                        <td className="py-3">
                          {round.pendingMatches > 0 ? (
                            <span className="text-orange-600 font-medium">{round.pendingMatches}</span>
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </td>
                        <td className="py-3">
                          <Link 
                            href={`/admin/rounds/${round.id}`}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            Ver detalle
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'players' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2">Jugador</th>
                      <th className="py-2">Email</th>
                      <th className="py-2">Se unió</th>
                      <th className="py-2">Comodines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player) => (
                      <tr key={player.id} className="border-b">
                        <td className="py-3 font-medium">{player.name}</td>
                        <td className="py-3 text-gray-600">{player.email}</td>
                        <td className="py-3">Ronda {player.joinedRound}</td>
                        <td className="py-3">
                          {player.comodinesUsed > 0 ? (
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                              {player.comodinesUsed}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}