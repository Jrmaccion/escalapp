// app/admin/AdminDashboardClient.tsx — PadelRise color tokens aplicados
"use client";

import {
  Calendar,
  Users,
  Trophy,
  CheckCircle,
  Clock,
  FileText,
  BarChart3,
  Play,
  UserMinus,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";

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
  comodinesUsados: number;
  suplentesActivos: number;
  revocables: number;
  mediaUsados: number;
};

type AdminDashboardClientProps = {
  tournament: SerializedTournament;
  rounds: SerializedRound[];
  stats: Stats;
};

export default function AdminDashboardClient({
  tournament,
  rounds,
  stats,
}: AdminDashboardClientProps) {
  const currentRound =
    rounds?.find((r) => !r.isClosed) || rounds?.[rounds.length - 1];

  const completionPercentage =
    stats.totalMatches > 0
      ? Math.round((stats.confirmedMatches / stats.totalMatches) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            Dashboard Admin
          </h1>
          <p className="text-muted-foreground">
            {tournament.title} •{" "}
            {format(new Date(tournament.startDate), "d MMM yyyy", {
              locale: es,
            })}{" "}
            –{" "}
            {format(new Date(tournament.endDate), "d MMM yyyy", { locale: es })}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-card text-card-foreground p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Jugadores
              </h3>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.totalPlayers}</div>
            <p className="text-xs text-muted-foreground">Participantes activos</p>
          </div>

          <div className="bg-card text-card-foreground p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Rondas
              </h3>
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.activeRounds}</div>
            <p className="text-xs text-muted-foreground">
              de {stats.totalRounds} activas
            </p>
          </div>

          <div className="bg-card text-card-foreground p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Pendientes
              </h3>
              <Clock className="h-4 w-4 text-accent" />
            </div>
            <div className="text-2xl font-bold">{stats.pendingMatches}</div>
            <p className="text-xs text-muted-foreground">resultados por validar</p>
          </div>

          <div className="bg-card text-card-foreground p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Progreso
              </h3>
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{completionPercentage}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.confirmedMatches} de {stats.totalMatches} partidos
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link
            href="/admin/results"
            className="block p-4 bg-primary/5 hover:bg-primary/10 rounded-lg border border-primary/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-primary" />
              <div>
                <div className="font-semibold text-foreground">
                  Validar Resultados
                </div>
                <div className="text-sm text-primary">
                  {stats.pendingMatches} pendientes
                </div>
              </div>
            </div>
          </Link>

          {currentRound && (
            <Link
              href={`/admin/rounds/${currentRound.id}?tab=substitutes`}
              className="block p-4 bg-accent/5 hover:bg-accent/10 rounded-lg border border-accent/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <UserMinus className="h-6 w-6 text-accent" />
                <div>
                  <div className="font-semibold text-foreground">
                    Gestionar Sustitutos
                  </div>
                  <div className="text-sm text-accent">
                    {stats.suplentesActivos} sustitutos activos
                  </div>
                </div>
              </div>
            </Link>
          )}

          <Link
            href="/admin/rounds"
            className="block p-4 bg-muted hover:bg-muted/80 rounded-lg border transition-colors"
          >
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-muted-foreground" />
              <div>
                <div className="font-semibold text-foreground">
                  Gestionar Rondas
                </div>
                <div className="text-sm text-muted-foreground">
                  {stats.activeRounds} activas
                </div>
              </div>
            </div>
          </Link>

          <Link
            href="/admin/tournaments"
            className="block p-4 bg-primary/5 hover:bg-primary/10 rounded-lg border border-primary/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-primary" />
              <div>
                <div className="font-semibold text-foreground">
                  Gestionar Torneos
                </div>
                <div className="text-sm text-primary">Crear y configurar</div>
              </div>
            </div>
          </Link>

          <Link
            href="/admin/players"
            className="block p-4 bg-muted hover:bg-muted/80 rounded-lg border transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-muted-foreground" />
              <div>
                <div className="font-semibold text-foreground">Jugadores</div>
                <div className="text-sm text-muted-foreground">
                  {stats.totalPlayers} registrados
                </div>
              </div>
            </div>
          </Link>

          <Link
            href="/admin/rankings"
            className="block p-4 bg-muted hover:bg-muted/80 rounded-lg border transition-colors"
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
              <div>
                <div className="font-semibold text-foreground">Rankings</div>
                <div className="text-sm text-muted-foreground">
                  Ver clasificaciones
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Ronda actual */}
        {currentRound && (
          <div className="bg-card text-card-foreground p-6 rounded-lg shadow border mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Ronda Actual
            </h2>
            <div className="space-y-4">
              <div>
                <div className="text-2xl font-bold">
                  Ronda {currentRound.number}
                </div>
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    currentRound.isClosed
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary border border-primary/20"
                  }`}
                >
                  {currentRound.isClosed ? "Cerrada" : "Activa"}
                </span>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <div>Grupos: {currentRound.groupsCount}</div>
                <div>Partidos: {currentRound.matchesCount}</div>
                <div>Pendientes: {currentRound.pendingMatches}</div>
              </div>
            </div>
          </div>
        )}

        {/* Resumen de rondas */}
        <div className="bg-card text-card-foreground p-6 rounded-lg shadow border">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Resumen de Rondas
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">Ronda</th>
                  <th className="py-2">Estado</th>
                  <th className="py-2">Grupos</th>
                  <th className="py-2">Partidos</th>
                  <th className="py-2">Pendientes</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rounds?.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-3 font-medium">Ronda {r.number}</td>
                    <td className="py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          r.isClosed
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary border border-primary/20"
                        }`}
                      >
                        {r.isClosed ? "Cerrada" : "Activa"}
                      </span>
                    </td>
                    <td className="py-3">{r.groupsCount}</td>
                    <td className="py-3">{r.matchesCount}</td>
                    <td className="py-3">
                      {r.pendingMatches > 0 ? (
                        <span className="inline-block px-2 py-1 bg-accent/10 text-accent border border-accent/20 rounded text-xs font-medium">
                          {r.pendingMatches}
                        </span>
                      ) : (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      )}
                    </td>
                    <td className="py-3">
                      <Link
                        href="/admin/rounds"
                        className="inline-block bg-muted text-foreground/80 hover:bg-muted/80 px-3 py-1 rounded text-sm transition-colors"
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

        {/* Sección de gestión de comodines */}
        {currentRound && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            {/* Panel acciones de ronda */}
            <div className="bg-card text-card-foreground rounded-lg shadow border">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-medium text-foreground">
                  ⚙️ Gestión de Ronda {currentRound.number}
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <Link href={`/admin/rounds/${currentRound.id}/comodines`}>
                  <Button variant="outline" className="w-full justify-between text-left">
                    <span className="flex items-center gap-2">🔄 Gestionar Comodines</span>
                    <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded-full">
                      {stats.comodinesUsados || 0} activos
                    </span>
                  </Button>
                </Link>

                <Link
                  href={`/admin/tournaments/${tournament.id}?tab=comodines&roundId=${currentRound.id}`}
                >
                  <Button variant="outline" className="w-full justify-between text-left">
                    <span className="flex items-center gap-2">👥 Gestionar Sustitutos</span>
                    <span className="text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-1 rounded-full">
                      {stats.suplentesActivos || 0} activos
                    </span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Panel de estadísticas de comodines */}
            <div className="bg-card text-card-foreground rounded-lg shadow border">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-medium text-foreground">📊 Estado de Comodines</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-2xl font-bold text-accent">
                      {stats.comodinesUsados}
                    </div>
                    <div className="text-muted-foreground">Comodines activos</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {stats.suplentesActivos}
                    </div>
                    <div className="text-muted-foreground">Con sustituto</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {stats.revocables}
                    </div>
                    <div className="text-muted-foreground">Revocables</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {stats.mediaUsados}
                    </div>
                    <div className="text-muted-foreground">Usando media</div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Link href={`/admin/rounds/${currentRound.id}/comodines`}>
                    <Button size="sm" className="w-full">
                      Gestionar Comodines
                    </Button>
                  </Link>
                  <Link
                    href={`/admin/tournaments/${tournament.id}?tab=comodines&roundId=${currentRound.id}`}
                  >
                    <Button size="sm" variant="outline" className="w-full">
                      Gestionar Sustitutos
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Panel de estadísticas de sustitutos */}
            <div className="bg-card text-card-foreground rounded-lg shadow border">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-medium text-foreground">
                  👥 Estado de Sustitutos
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Sustitutos activos:
                    </span>
                    <span className="font-bold">{stats.suplentesActivos}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Asignaciones revocables:
                    </span>
                    <span className="font-bold text-emerald-600">
                      {stats.revocables}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Comodines automáticos:
                    </span>
                    <span className="font-bold text-primary">
                      {stats.mediaUsados}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Los sustitutos pueden ser asignados y revocados por el admin</p>
                    <p>• Solo aplicable si no hay partidos confirmados</p>
                    <p>• Los puntos se asignan al jugador original</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
