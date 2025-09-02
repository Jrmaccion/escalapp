// app/mi-grupo/MiGrupoClient.tsx - VERSIÓN MEJORADA CON VISTA JERÁRQUICA
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  CheckCircle,
  Play,
  CalendarPlus,
  ArrowUp,
  ArrowDown,
  Minus,
  Crown,
  Star,
  Trophy,
  Target,
  Flame
} from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";

// Tipos existentes mantenidos...
type GroupData = {
  hasGroup: boolean;
  message?: string;
  tournament?: {
    title: string;
    currentRound: number;
  };
  group?: {
    number: number;
    level: string;
    totalPlayers: number;
  };
  myStatus?: {
    position: number;
    points: number;
    streak: number;
  };
  players?: Array<{
    id: string;
    name: string;
    points: number;
    position: number;
    isCurrentUser: boolean;
  }>;
  nextMatches?: Array<{
    id: string;
    setNumber: number;
    partner: string;
    opponents: string[];
    hasResult: boolean;
    isPending: boolean;
    isConfirmed: boolean;
    status?: string;
    proposedDate?: string | null;
    acceptedDate?: string | null;
    acceptedCount?: number;
    team1Player1Name?: string;
    team1Player2Name?: string;
    team2Player1Name?: string;
    team2Player2Name?: string;
    team1Games?: number | null;
    team2Games?: number | null;
  }>;
  allMatches?: Array<{
    id: string;
    setNumber: number;
    partner: string;
    opponents: string[];
    hasResult: boolean;
    isPending: boolean;
    isConfirmed: boolean;
    status?: string;
    proposedDate?: string | null;
    acceptedDate?: string | null;
    acceptedCount?: number;
    team1Player1Name?: string;
    team1Player2Name?: string;
    team2Player1Name?: string;
    team2Player2Name?: string;
    team1Games?: number | null;
    team2Games?: number | null;
  }>;
};

// Datos de preview
const PREVIEW_DATA: GroupData = {
  hasGroup: true,
  tournament: {
    title: "Torneo Escalera Primavera 2025",
    currentRound: 2,
  },
  group: {
    number: 2,
    level: "Nivel Medio",
    totalPlayers: 4,
  },
  myStatus: {
    position: 1,
    points: 8.5,
    streak: 2,
  },
  players: [
    { id: "you", name: "Tu Nombre", points: 8.5, position: 1, isCurrentUser: true },
    { id: "2", name: "Ana García", points: 7.2, position: 2, isCurrentUser: false },
    { id: "3", name: "Miguel López", points: 6.8, position: 3, isCurrentUser: false },
    { id: "4", name: "Laura Rodríguez", points: 5.1, position: 4, isCurrentUser: false },
  ],
  allMatches: [
    {
      id: "1",
      setNumber: 1,
      partner: "Laura Rodríguez",
      opponents: ["Ana García", "Miguel López"],
      hasResult: true,
      isPending: false,
      isConfirmed: true,
      status: "SCHEDULED",
      team1Player1Name: "Tu Nombre",
      team1Player2Name: "Laura Rodríguez",
      team2Player1Name: "Ana García",
      team2Player2Name: "Miguel López",
      team1Games: 4,
      team2Games: 2,
    },
    {
      id: "2",
      setNumber: 2,
      partner: "Miguel López",
      opponents: ["Ana García", "Laura Rodríguez"],
      hasResult: true,
      isPending: false,
      isConfirmed: false,
      status: "DATE_PROPOSED",
      acceptedCount: 3,
      team1Player1Name: "Tu Nombre",
      team1Player2Name: "Miguel López",
      team2Player1Name: "Ana García",
      team2Player2Name: "Laura Rodríguez",
      team1Games: 5,
      team2Games: 4,
    },
    {
      id: "3",
      setNumber: 3,
      partner: "Ana García",
      opponents: ["Miguel López", "Laura Rodríguez"],
      hasResult: false,
      isPending: true,
      isConfirmed: false,
      status: "PENDING",
      team1Player1Name: "Tu Nombre",
      team1Player2Name: "Ana García",
      team2Player1Name: "Miguel López",
      team2Player2Name: "Laura Rodríguez",
      team1Games: null,
      team2Games: null,
    },
  ],
};

export default function MiGrupoClient() {
  const { data: session } = useSession();
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/player/group", { cache: "no-store" });
      if (response.ok) {
        const groupData = (await response.json()) as GroupData;
        if (!groupData.hasGroup) {
          setData(PREVIEW_DATA);
          setIsPreviewMode(true);
        } else {
          setData(groupData);
          setIsPreviewMode(false);
        }
      } else {
        setData(PREVIEW_DATA);
        setIsPreviewMode(true);
      }
    } catch (error) {
      console.error("Error:", error);
      setData(PREVIEW_DATA);
      setIsPreviewMode(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getMatchStatusInfo = (match: NonNullable<GroupData["allMatches"]>[0]) => {
    if (match.isConfirmed) {
      return {
        label: "Completado",
        color: "bg-green-100 text-green-700 border-green-200",
        icon: CheckCircle,
      };
    }

    if (match.hasResult) {
      return {
        label: "Por confirmar",
        color: "bg-yellow-100 text-yellow-700 border-yellow-200",
        icon: Clock,
      };
    }

    switch (match.status) {
      case "SCHEDULED":
        return {
          label: "Programado",
          color: "bg-blue-100 text-blue-700 border-blue-200",
          icon: Calendar,
        };
      case "DATE_PROPOSED":
        return {
          label: `Fecha propuesta (${match.acceptedCount || 0}/4)`,
          color: "bg-purple-100 text-purple-700 border-purple-200",
          icon: Clock,
        };
      default:
        return {
          label: "Sin programar",
          color: "bg-gray-100 text-gray-700 border-gray-200",
          icon: CalendarPlus,
        };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const getMovementIcon = (position: number) => {
    if (position === 1) return <ArrowUp className="w-4 h-4 text-green-600" />;
    if (position === 4) return <ArrowDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-blue-600" />;
  };

  const getMovementText = (position: number) => {
    if (position === 1) return "Sube de grupo";
    if (position === 4) return "Baja de grupo";
    return "Se mantiene";
  };

  const getGroupLevelInfo = (groupNumber: number) => {
    switch (groupNumber) {
      case 1:
        return {
          level: "Superior",
          color: "bg-yellow-100 border-yellow-300 text-yellow-800",
          icon: Crown,
          gradient: "from-yellow-50 to-yellow-100"
        };
      case 2:
        return {
          level: "Medio",
          color: "bg-gray-100 border-gray-300 text-gray-700",
          icon: Target,
          gradient: "from-gray-50 to-gray-100"
        };
      case 3:
        return {
          level: "Inferior",
          color: "bg-orange-100 border-orange-300 text-orange-700",
          icon: Star,
          gradient: "from-orange-50 to-orange-100"
        };
      default:
        return {
          level: "Intermedio",
          color: "bg-blue-100 border-blue-300 text-blue-700",
          icon: Trophy,
          gradient: "from-blue-50 to-blue-100"
        };
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumbs />
        <div className="text-center py-20">
          <AlertTriangle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar</h2>
          <p className="text-gray-600 mb-4">No se pudo cargar la información del grupo.</p>
          <Button onClick={fetchData}>Reintentar</Button>
        </div>
      </div>
    );
  }

  const matches = (data.allMatches || data.nextMatches || [])
    .slice()
    .sort((a, b) => a.setNumber - b.setNumber);

  const completedMatches = matches.filter((m) => m.isConfirmed);
  const groupInfo = getGroupLevelInfo(data.group?.number || 2);
  const GroupIcon = groupInfo.icon;

  return (
    <div className={`px-4 py-6 max-w-6xl mx-auto space-y-6 ${isPreviewMode ? 'opacity-75' : ''}`}>
      <Breadcrumbs />

      {/* Header mejorado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Mi Grupo
          </h1>
          <p className="text-gray-600 mt-1">
            {data.tournament?.title} - Ronda {data.tournament?.currentRound}
          </p>
        </div>
        {isPreviewMode && (
          <div className="text-right">
            <Badge variant="secondary" className="mb-2">
              Vista Previa
            </Badge>
            <p className="text-sm text-gray-500">
              Datos de ejemplo
            </p>
          </div>
        )}
      </div>

      {/* Tarjeta de grupo con diseño jerárquico */}
      <Card className={`${groupInfo.color} border-2 bg-gradient-to-br ${groupInfo.gradient} shadow-lg`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <GroupIcon className="w-6 h-6" />
              Grupo {data.group?.number} - {groupInfo.level}
            </CardTitle>
            <div className="text-right">
              <Badge variant="outline" className="mb-1">
                {data.group?.totalPlayers} jugadores
              </Badge>
              <div className="text-sm opacity-75">
                Progreso: {completedMatches.length}/{matches.length} sets
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.players?.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                  player.isCurrentUser
                    ? 'bg-white/90 border-blue-300 shadow-md ring-2 ring-blue-200'
                    : 'bg-white/60 border-white/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-lg ${
                    player.position === 1 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                    player.position === 2 ? 'bg-gray-100 text-gray-700 border-gray-300' :
                    player.position === 3 ? 'bg-orange-100 text-orange-700 border-orange-300' :
                    'bg-red-100 text-red-700 border-red-300'
                  }`}>
                    {player.position === 1 ? '🥇' :
                     player.position === 2 ? '🥈' :
                     player.position === 3 ? '🥉' : player.position}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">
                        {player.name}
                        {player.isCurrentUser && (
                          <span className="text-blue-600 text-sm ml-2">(Tú)</span>
                        )}
                      </span>
                      {data.myStatus?.streak && player.isCurrentUser && data.myStatus.streak > 0 && (
                        <div className="flex items-center gap-1">
                          <Flame className="w-4 h-4 text-orange-500" />
                          <span className="text-sm text-orange-600 font-medium">
                            Racha {data.myStatus.streak}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {player.points.toFixed(1)} puntos acumulados
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    {getMovementIcon(player.position)}
                    <span className={`text-sm font-medium ${
                      player.position === 1 ? 'text-green-600' :
                      player.position === 4 ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {getMovementText(player.position)}
                    </span>
                  </div>
                  {player.position === 1 && (
                    <Badge className="bg-green-100 text-green-700 text-xs">
                      ¡Subes al Grupo {(data.group?.number || 2) - 1}!
                    </Badge>
                  )}
                  {player.position === 4 && (
                    <Badge className="bg-red-100 text-red-700 text-xs">
                      Bajas al Grupo {(data.group?.number || 2) + 1}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Información de movimientos */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <ArrowUp className="w-4 h-4" />
            Sistema de Escalera
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-700">
            <div className="flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-green-600" />
              <span><strong>1º lugar:</strong> Sube de grupo</span>
            </div>
            <div className="flex items-center gap-2">
              <Minus className="w-4 h-4 text-blue-600" />
              <span><strong>2º y 3º:</strong> Se mantienen</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-red-600" />
              <span><strong>4º lugar:</strong> Baja de grupo</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{data.myStatus?.position}º</div>
            <div className="text-sm text-gray-600">Mi Posición</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{data.myStatus?.points}</div>
            <div className="text-sm text-gray-600">Mis Puntos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {completedMatches.length}/{matches.length}
            </div>
            <div className="text-sm text-gray-600">Sets Completados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {data.myStatus?.streak || 0}
            </div>
            <div className="text-sm text-gray-600">Racha Actual</div>
          </CardContent>
        </Card>
      </div>

      {/* Sets del partido */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Mis Sets de la Ronda
          </CardTitle>
          <p className="text-sm text-gray-600">
            Los 4 jugadores del grupo juegan 3 sets con rotación de parejas
          </p>
        </CardHeader>
        <CardContent>
          {matches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No hay sets programados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => {
                const statusInfo = getMatchStatusInfo(match);
                const StatusIcon = statusInfo.icon;

                return (
                  <div
                    key={match.id}
                    className={`border-2 rounded-lg p-6 hover:shadow-md transition-all ${
                      match.isConfirmed 
                        ? 'border-green-200 bg-green-50' 
                        : match.hasResult 
                          ? 'border-yellow-200 bg-yellow-50' 
                          : 'border-gray-200 bg-white hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-lg px-3 py-1">
                          Set {match.setNumber}
                        </Badge>
                        <Badge className={`${statusInfo.color} border px-3 py-1`}>
                          <StatusIcon className="w-4 h-4 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                      {!isPreviewMode && !match.isConfirmed && (
                        <Link href={`/match/${match.id}`}>
                          <Button size="sm">
                            {match.hasResult ? 'Confirmar' : 'Jugar/Programar'}
                          </Button>
                        </Link>
                      )}
                      {isPreviewMode && !match.isConfirmed && (
                        <Button size="sm" disabled>
                          {match.hasResult ? 'Confirmar' : 'Jugar/Programar'}
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="text-center">
                        <div className="font-semibold text-blue-700 mb-1">
                          {match.team1Player1Name || match.partner ? 
                            `${match.team1Player1Name} + ${match.team1Player2Name}` :
                            `Tú + ${match.partner}`
                          }
                        </div>
                        {match.hasResult && (
                          <div className="text-2xl font-bold">
                            {match.team1Games}
                          </div>
                        )}
                      </div>

                      <div className="text-center">
                        <div className="text-gray-500 text-sm mb-2">vs</div>
                        {match.hasResult ? (
                          <div className="text-3xl font-bold text-gray-400">-</div>
                        ) : (
                          <div className="w-8 h-8 mx-auto bg-gray-200 rounded-full flex items-center justify-center">
                            <Play className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                      </div>

                      <div className="text-center">
                        <div className="font-semibold text-red-700 mb-1">
                          {match.team2Player1Name && match.team2Player2Name ?
                            `${match.team2Player1Name} + ${match.team2Player2Name}` :
                            match.opponents?.join(" + ") || "Oponentes"
                          }
                        </div>
                        {match.hasResult && (
                          <div className="text-2xl font-bold">
                            {match.team2Games}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Información adicional del partido */}
                    {match.status === "SCHEDULED" && match.acceptedDate && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex items-center gap-2 text-blue-700 text-sm">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">Programado para:</span>
                          <span>{formatDate(match.acceptedDate)}</span>
                        </div>
                      </div>
                    )}

                    {match.status === "DATE_PROPOSED" && match.proposedDate && (
                      <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded">
                        <div className="flex items-center gap-2 text-purple-700 text-sm">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">Fecha propuesta:</span>
                          <span>{formatDate(match.proposedDate)}</span>
                        </div>
                        <div className="text-purple-600 text-xs mt-1">
                          Confirmado por {match.acceptedCount || 0} de 4 jugadores
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call to action para modo preview */}
      {isPreviewMode && (
        <Card className="border-dashed border-2 border-blue-300 bg-blue-50">
          <CardContent className="p-8 text-center">
            <Target className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-blue-900 mb-2">
              ¡Ve Tu Grupo Real!
            </h3>
            <p className="text-blue-700 mb-6">
              Estos son datos de ejemplo. Únete a un torneo para competir en tu grupo real y escalar posiciones.
            </p>
            <Button variant="default">
              Contactar Administrador
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}