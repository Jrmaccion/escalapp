// app/admin/players/PlayersManager.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  UserPlus,
  Search,
  Plus,
  CheckCircle,
  X,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";

type AvailablePlayer = {
  id: string;
  name: string;
  email?: string;
};

type PlayersManagerProps = {
  tournament: {
    id: string;
    title: string;
    totalRounds: number;
  };
  currentPlayers: number;
  tournaments?: { id: string; title: string }[];
};

export default function PlayersManager({
  tournament,
  currentPlayers,
  tournaments = [],
}: PlayersManagerProps) {
  const router = useRouter();

  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [playersInTournament, setPlayersInTournament] = useState(currentPlayers);

  // Formulario para crear nuevo jugador
  const [newPlayer, setNewPlayer] = useState({
    name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    loadAvailablePlayers();
  }, [tournament.id]);

  async function loadAvailablePlayers() {
    try {
      setLoadingList(true);
      // CORREGIDO: Usar el nuevo endpoint para jugadores disponibles
      const res = await fetch(`/api/tournaments/${tournament.id}/available-players`, { 
        cache: "no-store" 
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      
      const data = await res.json();
      setAvailablePlayers(Array.isArray(data.availablePlayers) ? data.availablePlayers : []);
    } catch (err) {
      console.error("Error loading available players:", err);
      alert("No se pudieron cargar los jugadores disponibles.");
      setAvailablePlayers([]);
    } finally {
      setLoadingList(false);
    }
  }

  async function createPlayer() {
    if (!newPlayer.name || !newPlayer.email || !newPlayer.password) {
      alert("Todos los campos son obligatorios");
      return;
    }
    try {
      setLoadingCreate(true);
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlayer),
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || "Error al crear jugador");

      setNewPlayer({ name: "", email: "", password: "" });
      setShowAddForm(false);
      await loadAvailablePlayers();
      alert("Jugador creado correctamente.");
    } catch (err: any) {
      alert(err?.message || "Error al crear jugador");
    } finally {
      setLoadingCreate(false);
    }
  }

  async function addPlayersToTournament() {
    if (selectedPlayers.size === 0) {
      alert("Selecciona al menos un jugador");
      return;
    }

    try {
      setLoadingAdd(true);
      const res = await fetch(`/api/tournaments/${tournament.id}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerIds: Array.from(selectedPlayers),
        }),
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || "Error al añadir jugadores");

      // Actualizar contador local
      setPlayersInTournament((n) => n + selectedPlayers.size);
      setSelectedPlayers(new Set());
      await loadAvailablePlayers();
      router.refresh();

      alert(`Jugadores añadidos al torneo. Ronda objetivo: ${body.targetJoinedRoundNumber}`);
    } catch (err: any) {
      alert(err?.message || "Error al añadir jugadores");
    } finally {
      setLoadingAdd(false);
    }
  }

  const filteredPlayers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return availablePlayers;
    return availablePlayers.filter((p) =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q)
    );
  }, [availablePlayers, searchTerm]);

  const toggleSelect = (id: string) => {
    setSelectedPlayers((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" asChild>
              <Link href="/admin/players">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Ver Jugadores
              </Link>
            </Button>

            {/* Selector de torneo (opcional) */}
            {tournaments.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Torneo:</span>
                <select
                  className="border rounded-md px-2 py-1 text-sm"
                  value={tournament.id}
                  onChange={(e) =>
                    router.push(`/admin/tournaments/${e.target.value}/players/manage`)
                  }
                >
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <h1 className="text-3xl font-bold">Gestionar Jugadores</h1>
          <p className="text-gray-600">
            {tournament.title} • {playersInTournament} jugadores ya registrados
          </p>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium">Torneo destino:</span> {tournament.title} · ID:{" "}
            <code className="bg-gray-100 rounded px-1">{tournament.id.slice(0, 8)}…</code>
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-blue-600" />
                <div>
                  <div className="text-xl font-bold">{playersInTournament}</div>
                  <div className="text-xs text-gray-600">En torneo</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UserPlus className="h-6 w-6 text-green-600" />
                <div>
                  <div className="text-xl font-bold">{availablePlayers.length}</div>
                  <div className="text-xs text-gray-600">Disponibles</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-purple-600" />
                <div>
                  <div className="text-xl font-bold">{selectedPlayers.size}</div>
                  <div className="text-xs text-gray-600">Seleccionados</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Crear nuevo jugador */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Crear Nuevo Jugador
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          {showAddForm && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  placeholder="Nombre completo"
                  value={newPlayer.name}
                  onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={newPlayer.email}
                  onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
                />
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Contraseña"
                    value={newPlayer.password}
                    onChange={(e) => setNewPlayer({ ...newPlayer, password: e.target.value })}
                  />
                  <Button type="button" onClick={createPlayer} disabled={loadingCreate}>
                    {loadingCreate ? "Creando..." : "Crear"}
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Añadir jugadores existentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Añadir Jugadores Existentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Información */}
            <div className="p-4 bg-blue-50 rounded-lg mb-4">
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-1">Ronda de incorporación automática</p>
                <p className="text-blue-700">
                  Los jugadores se añadirán automáticamente a la ronda más apropiada según el estado del torneo.
                </p>
                <p className="text-blue-600 text-xs mt-1">
                  <strong>Seleccionados:</strong> {selectedPlayers.size} jugadores
                </p>
              </div>
            </div>

            {/* Búsqueda */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar jugadores disponibles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Lista de jugadores */}
            {loadingList ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Cargando jugadores...</p>
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {availablePlayers.length === 0
                  ? "Todos los jugadores ya están en este torneo"
                  : "No se encontraron jugadores con esa búsqueda"}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
                {filteredPlayers.map((player) => {
                  const isSelected = selectedPlayers.has(player.id);
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => toggleSelect(player.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? "bg-blue-50 border-blue-300"
                          : "bg-white border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{player.name}</div>
                          <div className="text-sm text-gray-600">{player.email || "—"}</div>
                        </div>
                        {isSelected && <CheckCircle className="h-5 w-5 text-blue-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Botón añadir */}
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={addPlayersToTournament}
                disabled={selectedPlayers.size === 0 || loadingAdd}
                className="flex-1"
              >
                {loadingAdd
                  ? "Añadiendo..."
                  : `Añadir ${selectedPlayers.size} jugadores al torneo`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* Utils */
async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}