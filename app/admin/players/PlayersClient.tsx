// app/admin/players/PlayersClient.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, UserPlus, Search, Filter, Trophy, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SerializedPlayer = {
  id: string;
  name: string;
  email: string;
  joinedRound: number;
  comodinesUsed: number;
  totalMatches: number;
  currentRound: number;
};

type Tournament = {
  id: string;
  title: string;
  totalRounds: number;
};

// ✅ NUEVO: Tipo para datos del selector
type TournamentSelectorData = {
  id: string;
  title: string;
  isActive: boolean;
  isCurrent: boolean;
};

type PlayersClientProps = {
  players: SerializedPlayer[];
  tournament: Tournament;
  // ✅ NUEVO: Props para el selector (opcionales para mantener compatibilidad)
  allTournaments?: TournamentSelectorData[];
  selectedTournamentId?: string;
};

export default function PlayersClient({ 
  players, 
  tournament, 
  allTournaments = [], 
  selectedTournamentId 
}: PlayersClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "new">("all");
  const [showTournamentSelector, setShowTournamentSelector] = useState(false);

  // ✅ NUEVO: Función para cambiar torneo
  const handleTournamentChange = (tournamentId: string) => {
    setShowTournamentSelector(false);
    router.push(`/admin/players?tournamentId=${tournamentId}`);
  };

  // ✅ RESTO DEL CÓDIGO ORIGINAL (sin cambios)
  const filteredPlayers = players.filter((player) => {
    const matchesSearch =
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterActive === "new") {
      return matchesSearch && player.joinedRound === tournament.totalRounds;
    }
    if (filterActive === "active") {
      return matchesSearch && player.totalMatches > 0;
    }
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header con navegación */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" asChild>
              <Link href="/admin">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard Admin
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/players/manage">
                <UserPlus className="w-4 h-4 mr-2" />
                Gestionar Jugadores
              </Link>
            </Button>
          </div>

          {/* ✅ NUEVO: Selector de torneo (solo si hay múltiples torneos) */}
          {allTournaments.length > 1 && (
            <div className="mb-6">
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4" />
                      <span>Selector de Torneo</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {allTournaments.length} disponibles
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Tienes múltiples torneos. Selecciona cuál quieres gestionar:
                    </p>
                    
                    {/* Botón principal del selector */}
                    <div className="relative">
                      <Button
                        variant="outline"
                        className="w-full justify-between text-left"
                        onClick={() => setShowTournamentSelector(!showTournamentSelector)}
                      >
                        <div className="flex items-center gap-3">
                          <Trophy className="w-4 h-4" />
                          <div>
                            <div className="font-medium">{tournament.title}</div>
                            <div className="text-xs text-gray-500">
                              {allTournaments.find(t => t.id === selectedTournamentId)?.isActive 
                                ? "Torneo activo" 
                                : "Torneo finalizado"}
                            </div>
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showTournamentSelector ? "rotate-180" : ""}`} />
                      </Button>

                      {/* Lista desplegable */}
                      {showTournamentSelector && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1">
                          <Card className="border shadow-lg">
                            <CardContent className="p-2">
                              <div className="space-y-1">
                                {/* Torneos activos primero */}
                                {allTournaments.filter(t => t.isActive).length > 0 && (
                                  <>
                                    <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b">
                                      Torneos Activos
                                    </div>
                                    {allTournaments.filter(t => t.isActive).map((t) => (
                                      <button
                                        key={t.id}
                                        onClick={() => handleTournamentChange(t.id)}
                                        className={`w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors ${
                                          t.isCurrent ? "bg-blue-50 border border-blue-200" : ""
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <Trophy className="w-4 h-4" />
                                            <div>
                                              <div className="font-medium text-sm">{t.title}</div>
                                              <div className="text-xs text-gray-500">Torneo en curso</div>
                                            </div>
                                          </div>
                                          {t.isCurrent && (
                                            <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                                              Actual
                                            </Badge>
                                          )}
                                        </div>
                                      </button>
                                    ))}
                                  </>
                                )}

                                {/* Separador */}
                                {allTournaments.filter(t => t.isActive).length > 0 && 
                                 allTournaments.filter(t => !t.isActive).length > 0 && (
                                  <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b">
                                    Torneos Finalizados
                                  </div>
                                )}

                                {/* Torneos finalizados */}
                                {allTournaments.filter(t => !t.isActive).map((t) => (
                                  <button
                                    key={t.id}
                                    onClick={() => handleTournamentChange(t.id)}
                                    className={`w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors opacity-75 ${
                                      t.isCurrent ? "bg-blue-50 border border-blue-200" : ""
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <Trophy className="w-4 h-4 text-gray-400" />
                                        <div>
                                          <div className="font-medium text-sm text-gray-700">{t.title}</div>
                                          <div className="text-xs text-gray-500">Torneo finalizado</div>
                                        </div>
                                      </div>
                                      {t.isCurrent && (
                                        <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                                          Actual
                                        </Badge>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <h1 className="text-3xl font-bold">Jugadores</h1>
          <p className="text-gray-600">
            {tournament.title} • {players.length} jugadores registrados
          </p>
        </div>

        {/* ✅ RESTO DEL CÓDIGO ORIGINAL (sin cambios) */}
        
        {/* Stats y controles */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{players.length}</div>
              <p className="text-xs text-muted-foreground">jugadores registrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activos</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {players.filter((p) => p.totalMatches > 0).length}
              </div>
              <p className="text-xs text-muted-foreground">han jugado partidos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nuevos</CardTitle>
              <UserPlus className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {players.filter((p) => p.joinedRound === tournament.totalRounds).length}
              </div>
              <p className="text-xs text-muted-foreground">última ronda</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comodines</CardTitle>
              <Filter className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {players.reduce((acc, p) => acc + p.comodinesUsed, 0)}
              </div>
              <p className="text-xs text-muted-foreground">utilizados en total</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros y búsqueda */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Buscar y Filtrar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterActive === "all" ? "default" : "outline"}
                  onClick={() => setFilterActive("all")}
                  size="sm"
                >
                  Todos
                </Button>
                <Button
                  variant={filterActive === "active" ? "default" : "outline"}
                  onClick={() => setFilterActive("active")}
                  size="sm"
                >
                  Activos
                </Button>
                <Button
                  variant={filterActive === "new" ? "default" : "outline"}
                  onClick={() => setFilterActive("new")}
                  size="sm"
                >
                  Nuevos
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de jugadores */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Jugadores ({filteredPlayers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-3 pr-4">Nombre</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Se unió</th>
                    <th className="py-3 pr-4">Partidos</th>
                    <th className="py-3 pr-4">Comodines</th>
                    <th className="py-3 pr-4">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        No se encontraron jugadores con esos criterios
                      </td>
                    </tr>
                  ) : (
                    filteredPlayers.map((player) => (
                      <tr key={player.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium">{player.name}</td>
                        <td className="py-3 pr-4 text-gray-600">{player.email}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline">Ronda {player.joinedRound}</Badge>
                        </td>
                        <td className="py-3 pr-4">{player.totalMatches}</td>
                        <td className="py-3 pr-4">
                          {player.comodinesUsed > 0 ? (
                            <Badge variant="secondary">{player.comodinesUsed}</Badge>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {player.totalMatches === 0 ? (
                            <Badge variant="outline" className="text-gray-500">
                              Sin partidos
                            </Badge>
                          ) : player.joinedRound === tournament.totalRounds ? (
                            <Badge variant="default" className="bg-purple-600">
                              Nuevo
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-600">
                              Activo
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Acciones adicionales */}
        <div className="mt-6 flex justify-center">
          <div className="text-sm text-gray-500 text-center">
            <p>Para gestionar usuarios individuales, contacta con el administrador del sistema.</p>
            <p className="mt-1">Los jugadores se registran automáticamente al unirse al torneo.</p>
          </div>
        </div>
      </div>
    </div>
  );
}