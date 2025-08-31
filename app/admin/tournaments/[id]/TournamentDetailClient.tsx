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
  Trash2,
  Power,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import TournamentPlayersManager from "./TournamentPlayersManager";
import TournamentTimeline from "@/components/tournament/TournamentTimeline";
import DeleteConfirmationModal from "@/components/modals/DeleteConfirmationModal";

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
  onDataRefresh?: () => void;
};

type TabId = 'overview' | 'rounds' | 'players';

export default function TournamentDetailClient({ 
  tournament, 
  rounds, 
  players, 
  stats,
  onDataRefresh
}: TournamentDetailClientProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter();
  const nf = new Intl.NumberFormat('es-ES');

  const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Resumen',  icon: Trophy },
    { id: 'rounds',   label: 'Rondas',   icon: Calendar },
    { id: 'players',  label: 'Jugadores',icon: Users },
  ];

  const currentRound = rounds.find(r => !r.isClosed) || rounds[rounds.length - 1];

  const isCurrentDate = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
    const dayEnd   = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
    return now >= dayStart && now <= dayEnd;
  };

  const roundStatus = (r: SerializedRound) => {
    if (r.isClosed) return { label: "Cerrada", cls: "bg-gray-100 text-gray-700" };
    if (isCurrentDate(r.startDate, r.endDate)) return { label: "En curso", cls: "bg-green-100 text-green-700" };
    const now = new Date();
    if (now < new Date(r.startDate)) return { label: "Próxima", cls: "bg-blue-100 text-blue-700" };
    return { label: "Fuera de plazo", cls: "bg-red-100 text-red-700" };
  };

  const toggleTournamentStatus = () => {
    const action = tournament.isActive ? 'desactivar' : 'activar';
    if (!confirm(`¿Seguro que quieres ${action} este torneo?`)) return;

    startTransition(async () => {
      try {
        const endpoint = tournament.isActive 
          ? `/api/tournaments/${tournament.id}/deactivate` 
          : `/api/tournaments/${tournament.id}/activate`;
        
        const res = await fetch(endpoint, { method: "PATCH" });
        if (res.ok) {
          router.refresh();
        } else {
          alert(`Error al ${action} torneo`);
        }
      } catch {
        alert("Error de conexión");
      }
    });
  };

  const deleteTournament = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournament.id}`, { 
          method: "DELETE" 
        });
        
        const data = await res.json();
        
        if (res.ok) {
          setShowDeleteModal(false);
          router.push('/admin/tournaments');
        } else {
          alert(data.error || "Error al eliminar torneo");
        }
      } catch (error) {
        console.error("Error deleting tournament:", error);
        alert("Error de conexión");
      }
    });
  };

  const handlePlayersUpdated = () => {
    if (onDataRefresh) onDataRefresh();
    else router.refresh();
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
                  <span>{nf.format(tournament.totalRounds)} rondas • {nf.format(tournament.roundDurationDays)} días/ronda</span>
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
                  onClick={() => setShowDeleteModal(true)}
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
            <div className="text-2xl font-bold">{nf.format(stats.totalPlayers)}</div>
            <p className="text-xs text-gray-500">registrados</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Progreso</h3>
              <Trophy className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold">{Math.round(stats.completionPercentage)}%</div>
            <p className="text-xs text-gray-500">{nf.format(stats.confirmedMatches)} / {nf.format(stats.totalMatches)} partidos</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Rondas</h3>
            <Play className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold">{nf.format(stats.totalRounds)}</div>
            <p className="text-xs text-gray-500">{nf.format(stats.activeRounds)} activas</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Pendientes</h3>
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
            <div className="text-2xl font-bold">{nf.format(stats.pendingMatches)}</div>
            <p className="text-xs text-gray-500">por validar</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow border">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
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
                        <div className="font-medium">{nf.format(currentRound.groupsCount)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Partidos:</span>
                        <div className="font-medium">{nf.format(currentRound.matchesCount)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Pendientes:</span>
                        <div className="font-medium text-orange-600">{nf.format(currentRound.pendingMatches)}</div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Aquí puedes mantener/añadir más contenido del overview si lo tenías */}
              </div>
            )}

            {activeTab === 'rounds' && (
              <div className="overflow-x-auto">
                {rounds.length === 0 ? (
                  <div className="text-center text-gray-500 py-10">
                    No hay rondas registradas en este torneo.
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ronda</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fechas</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupos</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jugadores</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partidos</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pendientes</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rounds.map((r) => {
                        const st = roundStatus(r);
                        return (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">Ronda {r.number}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {format(new Date(r.startDate), "d MMM", { locale: es })} –{" "}
                              {format(new Date(r.endDate), "d MMM yyyy", { locale: es })}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${st.cls}`}>{st.label}</span>
                            </td>
                            <td className="px-4 py-3">{nf.format(r.groupsCount)}</td>
                            <td className="px-4 py-3">{nf.format(r.playersCount)}</td>
                            <td className="px-4 py-3">{nf.format(r.matchesCount)}</td>
                            <td className="px-4 py-3">
                              <span className={r.pendingMatches > 0 ? "text-orange-600 font-medium" : "text-gray-600"}>
                                {nf.format(r.pendingMatches)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/admin/rounds/${r.id}`}
                                className="inline-flex items-center px-3 py-2 text-sm rounded-md border bg-white hover:bg-gray-50"
                              >
                                Abrir
                                <ChevronRight className="w-4 h-4 ml-1" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'players' && (
              <TournamentPlayersManager
                tournamentId={tournament.id}
                tournamentTitle={tournament.title}
                totalRounds={tournament.totalRounds}
                currentPlayers={players}
                onPlayersUpdated={handlePlayersUpdated}
              />
            )}
          </div>
        </div>

        {/* Modal de confirmación de eliminación */}
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={deleteTournament}
          tournament={{
            title: tournament.title,
            totalRounds: tournament.totalRounds,
            playersCount: players.length,
            totalMatches: stats.totalMatches,
            confirmedMatches: stats.confirmedMatches
          }}
          isLoading={isPending}
        />
      </div>
    </div>
  );
}
