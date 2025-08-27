"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, UserPlus, Search, Filter } from "lucide-react";
import { useState } from "react";
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

type PlayersClientProps = {
  players: SerializedPlayer[];
  tournament: Tournament;
};

export default function PlayersClient({ players, tournament }: PlayersClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "new">("all");

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
          </div>
          <h1 className="text-3xl font-bold">Jugadores</h1>
          <p className="text-gray-600">{tournament.title} • {players.length} jugadores registrados</p>
        </div>

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
                {players.filter(p => p.totalMatches > 0).length}
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
                {players.filter(p => p.joinedRound === tournament.totalRounds).length}
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
                          <Badge variant="outline">
                            Ronda {player.joinedRound}
                          </Badge>
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