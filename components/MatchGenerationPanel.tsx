"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Play, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Trash2,
  Info
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
  matches: Array<{
    id: string;
    setNumber: number;
  }>;
};

type MatchGenerationPanelProps = {
  roundId: string;
  groups: Group[];
  isAdmin?: boolean;
};

export default function MatchGenerationPanel({ 
  roundId, 
  groups, 
  isAdmin = false 
}: MatchGenerationPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // Función interna para recargar
  const handleUpdate = () => {
    window.location.reload();
  };

  // Calcular estadísticas de validación
  const groupStats = groups.map(group => ({
    ...group,
    playerCount: group.players.length,
    canGenerateMatches: group.players.length >= 4 && group.players.length % 4 === 0,
    hasMatches: group.matches.length > 0,
    missingPlayers: group.players.length < 4 ? 4 - group.players.length : 0,
    excessPlayers: group.players.length % 4,
  }));

  const validGroups = groupStats.filter(g => g.canGenerateMatches);
  const invalidGroups = groupStats.filter(g => !g.canGenerateMatches);
  const groupsWithMatches = groupStats.filter(g => g.hasMatches);
  const canGenerateAny = validGroups.length > 0;
  const totalPlayers = groups.reduce((acc, g) => acc + g.players.length, 0);

  const generateMatches = async (force = false) => {
    if (!isAdmin) {
      alert("Solo los administradores pueden generar partidos");
      return;
    }

    const confirmMessage = force 
      ? `¿Regenerar todos los partidos? Se eliminarán ${groupsWithMatches.length} grupos con partidos existentes.`
      : `¿Generar partidos para ${validGroups.length} grupos válidos?`;
      
    if (!confirm(confirmMessage)) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/rounds/${roundId}/generate-matches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force })
        });

        const data = await response.json();
        
        if (response.ok) {
          setMessage(data.message);
          setTimeout(() => setMessage(null), 5000);
          handleUpdate();
        } else {
          alert(data.error || 'Error generando partidos');
        }
      } catch (error) {
        alert('Error de conexión');
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Panel de estado general */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Generación de Partidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{groups.length}</div>
              <div className="text-sm text-gray-600">Grupos totales</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{validGroups.length}</div>
              <div className="text-sm text-gray-600">Grupos válidos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{invalidGroups.length}</div>
              <div className="text-sm text-gray-600">Grupos inválidos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totalPlayers}</div>
              <div className="text-sm text-gray-600">Jugadores total</div>
            </div>
          </div>

          {/* Mensaje de estado */}
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">{message}</span>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          {isAdmin && (
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => generateMatches(false)}
                disabled={isPending || !canGenerateAny}
                className="flex items-center gap-2"
              >
                {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Generar partidos ({validGroups.length} grupos)
              </Button>
              
              {groupsWithMatches.length > 0 && (
                <Button
                  onClick={() => generateMatches(true)}
                  disabled={isPending}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Regenerar todo (eliminar existentes)
                </Button>
              )}

              <Button
                onClick={handleUpdate}
                disabled={isPending}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          )}

          {!canGenerateAny && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">No se pueden generar partidos</span>
              </div>
              <p className="text-sm text-yellow-600 mt-1">
                Todos los grupos deben tener exactamente 4 jugadores (o múltiplos de 4).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estado detallado por grupo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Estado de los Grupos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {groupStats.map((group) => (
              <div 
                key={group.id} 
                className={`p-4 rounded-lg border ${
                  group.canGenerateMatches 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium">
                      Grupo {group.number} - Nivel {group.level}
                    </h4>
                    <div className="flex items-center gap-2">
                      {group.canGenerateMatches ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Válido
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Inválido
                        </Badge>
                      )}
                      
                      {group.hasMatches && (
                        <Badge variant="outline">
                          {group.matches.length} partidos
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <span className="text-sm font-medium">
                    {group.playerCount} jugadores
                  </span>
                </div>

                {/* Detalles del problema */}
                {!group.canGenerateMatches && (
                  <div className="text-sm">
                    {group.playerCount < 4 && (
                      <p className="text-red-600">
                        ⚠️ Faltan {group.missingPlayers} jugadores (mínimo 4)
                      </p>
                    )}
                    {group.playerCount >= 4 && group.excessPlayers > 0 && (
                      <p className="text-red-600">
                        ⚠️ {group.excessPlayers} jugadores sobrantes (se necesitan múltiplos de 4)
                      </p>
                    )}
                  </div>
                )}

                {/* Lista de jugadores */}
                <div className="mt-2">
                  <div className="text-xs text-gray-600 mb-1">Jugadores:</div>
                  <div className="flex flex-wrap gap-1">
                    {group.players
                      .sort((a, b) => a.position - b.position)
                      .map((player, index) => (
                        <span 
                          key={player.id}
                          className={`text-xs px-2 py-1 rounded ${
                            index < Math.floor(group.playerCount / 4) * 4
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {player.position}º {player.name}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 mb-1">Información sobre generación de partidos:</p>
            <ul className="text-blue-700 space-y-1">
              <li>• Cada grupo necesita exactamente 4 jugadores (o múltiplos de 4)</li>
              <li>• Se generan 3 partidos por grupo con rotación completa</li>
              <li>• La rotación asegura que cada jugador juegue con y contra todos</li>
              <li>• Los partidos existentes se mantienen salvo que uses "Regenerar todo"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}