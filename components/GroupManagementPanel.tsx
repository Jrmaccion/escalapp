"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Shuffle, 
  Crown, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Trash2,
  Info,
  Settings
} from "lucide-react";

type Group = {
  id: string;
  number: number;
  level: number;
  players: Array<{
    id: string;
    name: string;
    position: number;
  }>;
};

type Tournament = {
  id: string;
  title: string;
  totalPlayers: number;
};

type GroupManagementPanelProps = {
  roundId: string;
  roundNumber: number;
  tournament: Tournament;
  groups: Group[];
  availablePlayers: number;
  isAdmin?: boolean;
};

export default function GroupManagementPanel({ 
  roundId, 
  roundNumber,
  tournament,
  groups, 
  availablePlayers,
  isAdmin = false 
}: GroupManagementPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<'random' | 'ranking'>('random');
  const [playersPerGroup, setPlayersPerGroup] = useState(4);

  const hasGroups = groups.length > 0;
  const canCreateGroups = availablePlayers >= 4 && availablePlayers % playersPerGroup === 0;
  const totalGroupsNeeded = Math.floor(availablePlayers / playersPerGroup);

  const generateGroups = async (force = false) => {
    if (!isAdmin) {
      alert("Solo los administradores pueden generar grupos");
      return;
    }

    if (!canCreateGroups && !force) {
      alert(`No se pueden crear grupos. Necesitas ${playersPerGroup} jugadores o múltiplos de ${playersPerGroup}. Tienes ${availablePlayers} jugadores.`);
      return;
    }

    const confirmMessage = force 
      ? `¿Regenerar todos los grupos? Se eliminarán los ${groups.length} grupos existentes.`
      : `¿Crear ${totalGroupsNeeded} grupos con ${playersPerGroup} jugadores cada uno usando distribución '${strategy === 'random' ? 'aleatoria' : 'por ranking'}'?`;
      
    if (!confirm(confirmMessage)) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/rounds/${roundId}/generate-groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            strategy, 
            playersPerGroup,
            force 
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          setMessage(data.message);
          setTimeout(() => setMessage(null), 5000);
          window.location.reload();
        } else {
          alert(data.error || 'Error generando grupos');
        }
      } catch (error) {
        alert('Error de conexión');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Estado general */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Gestión de Grupos - Ronda {roundNumber}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{availablePlayers}</div>
              <div className="text-sm text-gray-600">Jugadores disponibles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{groups.length}</div>
              <div className="text-sm text-gray-600">Grupos creados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totalGroupsNeeded}</div>
              <div className="text-sm text-gray-600">Grupos necesarios</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{playersPerGroup}</div>
              <div className="text-sm text-gray-600">Jugadores por grupo</div>
            </div>
          </div>

          {/* Estado de validación */}
          {canCreateGroups ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium">Listo para crear grupos</span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">
                  No se pueden crear grupos: {availablePlayers} jugadores no es divisible por {playersPerGroup}
                </span>
              </div>
              <p className="text-sm text-red-600 mt-1">
                Necesitas añadir {playersPerGroup - (availablePlayers % playersPerGroup)} jugadores más o cambiar el tamaño de grupo.
              </p>
            </div>
          )}

          {/* Mensaje de estado */}
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">{message}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuración y acciones */}
      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generate">Generar Grupos</TabsTrigger>
          <TabsTrigger value="view">Ver Grupos Actuales</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configuración de Grupos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Estrategia de distribución */}
              <div>
                <label className="block text-sm font-medium mb-2">Estrategia de distribución</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => setStrategy('random')}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      strategy === 'random' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Shuffle className="w-4 h-4" />
                      <span className="font-medium">Aleatoria</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Distribución completamente aleatoria de jugadores.
                    </p>
                  </button>

                  <button
                    onClick={() => setStrategy('ranking')}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      strategy === 'ranking' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="w-4 h-4" />
                      <span className="font-medium">Por Ranking</span>
                      {roundNumber === 1 && (
                        <Badge variant="outline" className="text-xs">No disponible</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {roundNumber === 1 
                        ? "No hay ranking previo en la primera ronda."
                        : "Equilibra grupos según ranking de ronda anterior."
                      }
                    </p>
                  </button>
                </div>
              </div>

              {/* Jugadores por grupo */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Jugadores por grupo: {playersPerGroup}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="4"
                    max="8"
                    step="1"
                    value={playersPerGroup}
                    onChange={(e) => setPlayersPerGroup(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <div className="flex gap-2">
                    {[4, 6, 8].map(size => (
                      <button
                        key={size}
                        onClick={() => setPlayersPerGroup(size)}
                        className={`px-3 py-1 rounded text-sm ${
                          playersPerGroup === size
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Con {playersPerGroup} jugadores por grupo se crearán {Math.floor(availablePlayers / playersPerGroup)} grupos
                  {availablePlayers % playersPerGroup > 0 && (
                    <span className="text-red-600"> ({availablePlayers % playersPerGroup} jugadores quedarán fuera)</span>
                  )}
                </p>
              </div>

              {/* Botones de acción */}
              {isAdmin && (
                <div className="flex flex-wrap gap-3 pt-4">
                  <Button
                    onClick={() => generateGroups(false)}
                    disabled={isPending || hasGroups}
                    className="flex items-center gap-2"
                  >
                    {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                    Crear Grupos
                  </Button>
                  
                  {hasGroups && (
                    <Button
                      onClick={() => generateGroups(true)}
                      disabled={isPending}
                      variant="destructive"
                      className="flex items-center gap-2"
                    >
                      {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Regenerar Grupos
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="view" className="space-y-4">
          {hasGroups ? (
            <div className="grid gap-4">
              {groups.map((group) => (
                <Card key={group.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Grupo {group.number} - Nivel {group.level}</span>
                      <Badge variant="outline">{group.players.length} jugadores</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.players
                        .sort((a, b) => a.position - b.position)
                        .map((player) => (
                          <div key={player.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold">
                              {player.position}
                            </div>
                            <span className="font-medium">{player.name}</span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No hay grupos creados para esta ronda</p>
                <p className="text-sm text-gray-500">Usa la pestaña "Generar Grupos" para crear los grupos.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 mb-1">Información sobre generación de grupos:</p>
            <ul className="text-blue-700 space-y-1">
              <li>• <strong>Aleatoria:</strong> Distribución completamente aleatoria</li>
              <li>• <strong>Por Ranking:</strong> Distribuye en serpiente para equilibrar niveles (ej: Grupo1: 1°,4°,5°,8° | Grupo2: 2°,3°,6°,7°)</li>
              <li>• Solo se incluyen jugadores que se unieron en esta ronda o anteriores</li>
              <li>• Una vez creados los grupos, puedes generar los partidos</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}