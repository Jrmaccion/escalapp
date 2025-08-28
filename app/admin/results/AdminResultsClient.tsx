"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Edit, 
  Trash2, 
  Eye, 
  Users,
  Calendar,
  Trophy,
  Search,
  Filter,
  MoreHorizontal,
  CheckSquare,
  Square,
  RefreshCw
} from "lucide-react";
import Link from "next/link";

type AdminMatch = {
  id: string;
  setNumber: number;
  team1Player1Name: string;
  team1Player2Name: string;
  team2Player1Name: string;
  team2Player2Name: string;
  team1Games: number | null;
  team2Games: number | null;
  tiebreakScore: string | null;
  isConfirmed: boolean;
  reportedById: string | null;
  reportedByName: string | null;
  confirmedById: string | null;
  confirmedByName: string | null;
  photoUrl: string | null;
  groupNumber: number;
  groupLevel: number;
  roundNumber: number;
  tournamentId: string;
  tournamentTitle: string;
  isRoundClosed: boolean;
  roundEndDate: string;
  createdAt: string;
};

type Tournament = {
  id: string;
  title: string;
  isActive: boolean;
};

type AdminResultsStats = {
  totalMatches: number;
  confirmedMatches: number;
  pendingMatches: number;
  reportedMatches: number;
  unplayedMatches: number;
  conflictMatches: number;
  activeRounds: number;
  completionRate: number;
};

export default function AdminResultsClient() {
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [stats, setStats] = useState<AdminResultsStats | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  
  // Filtros y búsqueda
  const [filter, setFilter] = useState("needs_review");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTournament, setSelectedTournament] = useState("");
  
  // Selección múltiple
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        filter,
        search: searchTerm,
        ...(selectedTournament && { tournamentId: selectedTournament })
      });
      
      const response = await fetch(`/api/admin/results?${params}`);
      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches);
        setStats(data.stats);
        setTournaments(data.tournaments);
      }
    } catch (error) {
      console.error("Error fetching results:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [filter, selectedTournament]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm !== "") {
        fetchResults();
      } else if (searchTerm === "") {
        fetchResults();
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  const handleBatchAction = async (action: string, resultData?: any) => {
    if (selectedMatches.size === 0) {
      alert("Selecciona al menos un match");
      return;
    }

    let confirmMessage = "";
    switch (action) {
      case 'validate_pending':
        confirmMessage = `¿Validar ${selectedMatches.size} matches pendientes?`;
        break;
      case 'clear_results':
        confirmMessage = `¿Limpiar resultados de ${selectedMatches.size} matches?`;
        break;
      case 'mark_confirmed':
        confirmMessage = `¿Marcar como confirmados ${selectedMatches.size} matches?`;
        break;
      default:
        confirmMessage = `¿Ejecutar acción en ${selectedMatches.size} matches?`;
    }

    if (!confirm(confirmMessage)) return;

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/results', {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchIds: Array.from(selectedMatches),
            action,
            resultData
          }),
        });

        if (response.ok) {
          const result = await response.json();
          alert(result.message);
          setSelectedMatches(new Set());
          setSelectAll(false);
          fetchResults();
        } else {
          const error = await response.json();
          alert(error.error || "Error en la operación");
        }
      } catch (error) {
        alert("Error de conexión");
      }
    });
  };

  const handleSelectMatch = (matchId: string) => {
    const newSelected = new Set(selectedMatches);
    if (newSelected.has(matchId)) {
      newSelected.delete(matchId);
    } else {
      newSelected.add(matchId);
    }
    setSelectedMatches(newSelected);
    setSelectAll(newSelected.size === matches.length && matches.length > 0);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedMatches(new Set());
      setSelectAll(false);
    } else {
      setSelectedMatches(new Set(matches.map(m => m.id)));
      setSelectAll(true);
    }
  };

  const formatScore = (match: AdminMatch): string => {
    if (match.team1Games === null || match.team2Games === null) {
      return "Sin resultado";
    }
    const baseScore = `${match.team1Games}-${match.team2Games}`;
    if (match.tiebreakScore) {
      return `${baseScore} (TB ${match.tiebreakScore})`;
    }
    return baseScore;
  };

  const getMatchStatus = (match: AdminMatch) => {
    if (match.isConfirmed) {
      return { label: "Confirmado", color: "bg-green-100 text-green-700", icon: CheckCircle };
    } else if (match.reportedById && match.team1Games !== null) {
      return { label: "Pendiente", color: "bg-yellow-100 text-yellow-700", icon: Clock };
    } else {
      return { label: "Sin jugar", color: "bg-gray-100 text-gray-700", icon: Calendar };
    }
  };

  const getRoundStatus = (match: AdminMatch) => {
    const endDate = new Date(match.roundEndDate);
    const now = new Date();
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (match.isRoundClosed) return "Cerrada";
    if (daysLeft <= 0) return "Vencida";
    if (daysLeft <= 1) return "Último día";
    if (daysLeft <= 3) return `${daysLeft} días`;
    return "Activa";
  };

  const filterOptions = [
    { value: "all", label: "Todos los matches" },
    { value: "needs_review", label: "Necesitan revisión" },
    { value: "pending", label: "Pendientes confirmación" },
    { value: "unplayed", label: "Sin jugar" },
    { value: "confirmed", label: "Confirmados" },
    { value: "conflicts", label: "Conflictos (+24h)" },
    { value: "active_rounds", label: "Rondas activas" }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Resultados</h1>
              <p className="text-gray-600">Validar, corregir y gestionar todos los resultados del sistema</p>
            </div>
            <Button onClick={fetchResults} disabled={isPending} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalMatches}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.confirmedMatches}</div>
                <div className="text-xs text-gray-600">Confirmados</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.pendingMatches}</div>
                <div className="text-xs text-gray-600">Pendientes</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{stats.unplayedMatches}</div>
                <div className="text-xs text-gray-600">Sin jugar</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.conflictMatches}</div>
                <div className="text-xs text-gray-600">Conflictos</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.activeRounds}</div>
                <div className="text-xs text-gray-600">R. Activas</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.completionRate}%</div>
                <div className="text-xs text-gray-600">Completado</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{matches.length}</div>
                <div className="text-xs text-gray-600">Filtrados</div>
              </div>
            </Card>
          </div>
        )}

        {/* Controles */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Filtro por estado */}
            <div>
              <label className="block text-sm font-medium mb-1">Filtro</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                {filterOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por torneo */}
            <div>
              <label className="block text-sm font-medium mb-1">Torneo</label>
              <select
                value={selectedTournament}
                onChange={(e) => setSelectedTournament(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">Todos los torneos</option>
                {tournaments.map(tournament => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.title} {tournament.isActive ? "(Activo)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Búsqueda */}
            <div>
              <label className="block text-sm font-medium mb-1">Búsqueda</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar jugador o torneo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Selección múltiple */}
            <div className="flex items-end">
              <Button
                onClick={handleSelectAll}
                variant="outline"
                className="w-full"
              >
                {selectAll ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
                {selectAll ? "Deseleccionar" : "Seleccionar todo"}
              </Button>
            </div>
          </div>

          {/* Acciones masivas */}
          {selectedMatches.size > 0 && (
            <div className="border-t pt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => handleBatchAction('validate_pending')}
                disabled={isPending}
                variant="outline"
                className="text-green-600 border-green-300 hover:bg-green-50"
              >
                Validar Pendientes ({selectedMatches.size})
              </Button>
              <Button
                onClick={() => handleBatchAction('mark_confirmed')}
                disabled={isPending}
                variant="outline"
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                Marcar Confirmados ({selectedMatches.size})
              </Button>
              <Button
                onClick={() => handleBatchAction('clear_results')}
                disabled={isPending}
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Limpiar Resultados ({selectedMatches.size})
              </Button>
            </div>
          )}
        </div>

        {/* Tabla de resultados */}
        <Card>
          <CardHeader>
            <CardTitle>Matches ({matches.length} encontrados)</CardTitle>
          </CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No se encontraron matches con los filtros aplicados
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-3 w-8">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={handleSelectAll}
                          className="rounded"
                        />
                      </th>
                      <th className="pb-3">Torneo</th>
                      <th className="pb-3">R/G/S</th>
                      <th className="pb-3">Equipos</th>
                      <th className="pb-3">Resultado</th>
                      <th className="pb-3">Estado</th>
                      <th className="pb-3">Ronda</th>
                      <th className="pb-3">Reportado</th>
                      <th className="pb-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((match) => {
                      const status = getMatchStatus(match);
                      const StatusIcon = status.icon;
                      
                      return (
                        <tr key={match.id} className="border-b hover:bg-gray-50">
                          <td className="py-3">
                            <input
                              type="checkbox"
                              checked={selectedMatches.has(match.id)}
                              onChange={() => handleSelectMatch(match.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="py-3">
                            <div className="font-medium text-sm">
                              {match.tournamentTitle.length > 20 
                                ? match.tournamentTitle.substring(0, 20) + '...' 
                                : match.tournamentTitle
                              }
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="text-xs text-gray-600">
                              R{match.roundNumber}/G{match.groupNumber}/S{match.setNumber}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="text-xs">
                              <div className="text-blue-700">
                                {match.team1Player1Name} + {match.team1Player2Name}
                              </div>
                              <div className="text-gray-400 my-1">vs</div>
                              <div className="text-red-700">
                                {match.team2Player1Name} + {match.team2Player2Name}
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="font-mono text-sm">
                              {formatScore(match)}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${status.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="text-xs text-gray-600">
                              {getRoundStatus(match)}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="text-xs text-gray-600">
                              {match.reportedByName || '-'}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex gap-1">
                              <Link href={`/match/${match.id}`}>
                                <Button size="sm" variant="outline" className="p-1">
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </Link>
                              {!match.isRoundClosed && (
                                <Link href={`/match/${match.id}`}>
                                  <Button size="sm" variant="outline" className="p-1">
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}