"use client";

import { 
  Calendar, 
  Users, 
  Trophy, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Settings,
  FileText,
  BarChart3,
  Play
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type SerializedTournament = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  totalRounds: number;
  roundDurationDays: number;
};

type SerializedRound = {
  id: string;
  number: number;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  groupsCount: number;
  matchesCount: number;
  pendingMatches: number;
};

type Stats = {
  totalPlayers: number;
  totalRounds: number;
  activeRounds: number;
  totalMatches: number;
  pendingMatches: number;
  confirmedMatches: number;
};

type AdminDashboardClientProps = {
  tournament: SerializedTournament;
  rounds: SerializedRound[];
  stats: Stats;
};

export default function AdminDashboardClient({ tournament, rounds, stats }: AdminDashboardClientProps) {
  const currentRound = rounds?.find(r => !r.isClosed) || rounds?.[rounds.length - 1];
  const completionPercentage = stats.totalMatches > 0 
    ? Math.round((stats.confirmedMatches / stats.totalMatches) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard Admin</h1>
          <p className="text-gray-600">
            {tournament.title} • {format(new Date(tournament.startDate), "d MMM yyyy", { locale: es })} – {format(new Date(tournament.endDate), "d MMM yyyy", { locale: es })}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Jugadores</h3>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold">{stats.totalPlayers}</div>
            <p className="text-xs text-gray-500">Participantes activos</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Rondas</h3>
              <Calendar className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold">{stats.activeRounds}</div>
            <p className="text-xs text-gray-500">de {stats.totalRounds} activas</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Pendientes</h3>
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
            <div className="text-2xl font-bold">{stats.pendingMatches}</div>
            <p className="text-xs text-gray-500">resultados por validar</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Progreso</h3>
              <Trophy className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold">{completionPercentage}%</div>
            <p className="text-xs text-gray-500">
              {stats.confirmedMatches} de {stats.totalMatches} partidos
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link href="/admin/results" className="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-blue-600" />
              <div>
                <div className="font-semibold text-blue-900">Validar Resultados</div>
                <div className="text-sm text-blue-600">{stats.pendingMatches} pendientes</div>
              </div>
            </div>
          </Link>

          <Link href="/admin/rounds" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-gray-600" />
              <div>
                <div className="font-semibold text-gray-900">Gestionar Rondas</div>
                <div className="text-sm text-gray-600">{stats.activeRounds} activas</div>
              </div>
            </div>
          </Link>

          <Link href="/admin/tournaments" className="block p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-purple-600" />
              <div>
              <div className="font-semibold text-purple-900">Gestionar Torneos</div>
              <div className="text-sm text-purple-600">Crear y configurar</div>
              </div>
            </div>
          </Link>

          <Link href="/admin/players" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-gray-600" />
              <div>
                <div className="font-semibold text-gray-900">Jugadores</div>
                <div className="text-sm text-gray-600">{stats.totalPlayers} registrados</div>
              </div>
            </div>
          </Link>

          <Link href="/admin/rankings" className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-gray-600" />
              <div>
                <div className="font-semibold text-gray-900">Rankings</div>
                <div className="text-sm text-gray-600">Ver clasificaciones</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Ronda actual */}
        {currentRound && (
          <div className="bg-white p-6 rounded-lg shadow border mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Play className="h-5 w-5" />
              Ronda Actual
            </h2>
            <div className="space-y-4">
              <div>
                <div className="text-2xl font-bold">Ronda {currentRound.number}</div>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  currentRound.isClosed 
                    ? 'bg-gray-100 text-gray-700' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {currentRound.isClosed ? "Cerrada" : "Activa"}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 space-y-1">
                <div>Grupos: {currentRound.groupsCount}</div>
                <div>Partidos: {currentRound.matchesCount}</div>
                <div>Pendientes: {currentRound.pendingMatches}</div>
              </div>
            </div>
          </div>
        )}

        {/* Resumen de rondas */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resumen de Rondas
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Ronda</th>
                  <th className="py-2">Estado</th>
                  <th className="py-2">Grupos</th>
                  <th className="py-2">Partidos</th>
                  <th className="py-2">Pendientes</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rounds?.map((round) => (
                  <tr key={round.id} className="border-b">
                    <td className="py-3 font-medium">Ronda {round.number}</td>
                    <td className="py-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        round.isClosed 
                          ? 'bg-gray-100 text-gray-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {round.isClosed ? "Cerrada" : "Activa"}
                      </span>
                    </td>
                    <td className="py-3">{round.groupsCount}</td>
                    <td className="py-3">{round.matchesCount}</td>
                    <td className="py-3">
                      {round.pendingMatches > 0 ? (
                        <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                          {round.pendingMatches}
                        </span>
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                    </td>
                    <td className="py-3">
                      <Link 
                        href="/admin/rounds"
                        className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm transition-colors"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}