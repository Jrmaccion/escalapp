"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Camera,
  Trophy,
  Target,
  Info,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type MatchData = {
  id: string;
  setNumber: number;
  team1Player1Id: string;
  team1Player1Name: string;
  team1Player2Id: string;
  team1Player2Name: string;
  team2Player1Id: string;
  team2Player1Name: string;
  team2Player2Id: string;
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
  group: {
    id: string;
    number: number;
    level: number;
    players: Array<{
      id: string;
      name: string;
      position: number;
      points: number;
      streak: number;
      usedComodin: boolean;
    }>;
  };
  round: {
    id: string;
    number: number;
    startDate: string;
    endDate: string;
    isClosed: boolean;
  };
  tournament: {
    id: string;
    title: string;
  };
};

type MatchDetailClientProps = {
  match: MatchData;
  currentPlayerId: string | null | undefined;
  isAdmin: boolean;
};

export default function MatchDetailClient({ match, currentPlayerId, isAdmin }: MatchDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    team1Games: match.team1Games || 0,
    team2Games: match.team2Games || 0,
    tiebreakScore: match.tiebreakScore || ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTiebreak, setShowTiebreak] = useState(Boolean(match.tiebreakScore));

  const isPlayerInMatch = currentPlayerId && [
    match.team1Player1Id,
    match.team1Player2Id,
    match.team2Player1Id,
    match.team2Player2Id
  ].includes(currentPlayerId);

  const canReport = isPlayerInMatch && !match.reportedById && !match.round.isClosed;
  const canConfirm = isPlayerInMatch && match.reportedById && match.reportedById !== currentPlayerId && !match.confirmedById && !match.round.isClosed;
  const canEdit = isAdmin && !match.round.isClosed;
  const hasResult = match.team1Games !== null && match.team2Games !== null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validar que al menos un equipo llegue a 4
    if (Math.max(formData.team1Games, formData.team2Games) < 4) {
      newErrors.games = "Al menos un equipo debe llegar a 4 juegos";
    }

    // Validar diferencia de 2 juegos o tie-break
    const diff = Math.abs(formData.team1Games - formData.team2Games);
    const maxGames = Math.max(formData.team1Games, formData.team2Games);

    if (maxGames > 5) {
      newErrors.games = "Máximo 5 juegos por equipo (con tie-break)";
    } else if (formData.team1Games === 4 && formData.team2Games === 4) {
      if (!formData.tiebreakScore) {
        newErrors.tiebreak = "Se requiere tie-break cuando hay 4-4";
      } else {
        const tiebreakRegex = /^\d+-\d+$/;
        if (!tiebreakRegex.test(formData.tiebreakScore)) {
          newErrors.tiebreak = "Formato inválido. Use: 7-5";
        } else {
          const [score1, score2] = formData.tiebreakScore.split('-').map(Number);
          if (Math.max(score1, score2) < 7 || Math.abs(score1 - score2) < 2) {
            newErrors.tiebreak = "Tie-break debe llegar a 7 con diferencia de 2";
          }
        }
      }
    } else if (maxGames === 4 && diff < 2) {
      newErrors.games = "Se requiere diferencia de 2 juegos o tie-break en 4-4";
    }

    return newErrors;
  };

  const handleGamesChange = (team: 'team1' | 'team2', value: string) => {
    const games = Math.max(0, Math.min(5, parseInt(value) || 0));
    const newFormData = { ...formData, [`${team}Games`]: games };
    
    // Auto-detectar necesidad de tie-break
    if (newFormData.team1Games === 4 && newFormData.team2Games === 4) {
      setShowTiebreak(true);
    } else {
      setShowTiebreak(false);
      newFormData.tiebreakScore = "";
    }

    setFormData(newFormData);
    setErrors({});
  };

  const handleSubmit = async (action: 'report' | 'confirm' | 'admin_force') => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const finalFormData = {
      ...formData,
      tiebreakScore: showTiebreak ? formData.tiebreakScore : null,
      action
    };

    startTransition(async () => {
      try {
        const response = await fetch(`/api/matches/${match.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(finalFormData),
        });

        if (response.ok) {
          router.push("/dashboard");
        } else {
          const error = await response.json();
          setErrors({ general: error.error || "Error al actualizar el resultado" });
        }
      } catch (error) {
        setErrors({ general: "Error de conexión" });
      }
    });
  };

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de que quieres eliminar este resultado?")) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/matches/${match.id}`, {
          method: "DELETE",
        });

        if (response.ok) {
          router.push("/dashboard");
        } else {
          const error = await response.json();
          setErrors({ general: error.error || "Error al eliminar el resultado" });
        }
      } catch (error) {
        setErrors({ general: "Error de conexión" });
      }
    });
  };

  const getTeamNames = (team: 'team1' | 'team2') => {
    if (team === 'team1') {
      return `${match.team1Player1Name} + ${match.team1Player2Name}`;
    }
    return `${match.team2Player1Name} + ${match.team2Player2Name}`;
  };

  const formatExistingScore = () => {
    if (!hasResult) return "Sin resultado";
    const baseScore = `${match.team1Games}-${match.team2Games}`;
    if (match.tiebreakScore) {
      return `${baseScore} (TB ${match.tiebreakScore})`;
    }
    return baseScore;
  };

  const getMyPosition = () => {
    return match.group.players.find(p => p.id === currentPlayerId);
  };

  const daysUntilRoundEnd = Math.ceil(
    (new Date(match.round.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/dashboard" className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Link>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Set {match.setNumber}</h1>
              <p className="text-gray-600">{match.tournament.title}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span>Ronda {match.round.number}</span>
                <span>Grupo {match.group.number} - Nivel {match.group.level}</span>
                <span>Termina: {format(new Date(match.round.endDate), "d MMM", { locale: es })}</span>
              </div>
            </div>
            <div className="text-right">
              {match.isConfirmed ? (
                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Confirmado
                </div>
              ) : match.reportedById ? (
                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-yellow-100 text-yellow-800">
                  <Clock className="w-3 h-3 mr-1" />
                  Pendiente
                </div>
              ) : (
                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-gray-100 text-gray-800">
                  <Calendar className="w-3 h-3 mr-1" />
                  Sin reportar
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alert de tiempo restante */}
        {daysUntilRoundEnd <= 3 && daysUntilRoundEnd > 0 && (
          <div className={`mb-6 p-4 rounded-lg border ${
            daysUntilRoundEnd <= 1 
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-yellow-50 border-yellow-200 text-yellow-700'
          }`}>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="font-medium">
                {daysUntilRoundEnd === 1
                  ? 'Último día de la ronda - ¡Reporta tus resultados!'
                  : `Quedan ${daysUntilRoundEnd} días para terminar la ronda`
                }
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulario principal */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Resultado del Set</CardTitle>
                  {match.round.isClosed && (
                    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-gray-100 text-gray-800">
                      Ronda Cerrada
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Equipos */}
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-blue-900">Equipo 1</h3>
                        <p className="text-sm text-blue-700">{getTeamNames('team1')}</p>
                      </div>
                      <Trophy className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>
                  <div className="text-center text-gray-500 font-medium">VS</div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-red-900">Equipo 2</h3>
                        <p className="text-sm text-red-700">{getTeamNames('team2')}</p>
                      </div>
                      <Trophy className="h-8 w-8 text-red-600" />
                    </div>
                  </div>
                </div>

                {errors.general && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                    {errors.general}
                  </div>
                )}

                {/* Resultado existente o formulario */}
                {hasResult && match.isConfirmed && !canEdit ? (
                  <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <div className="text-2xl font-bold text-green-900 mb-2">
                      {formatExistingScore()}
                    </div>
                    <p className="text-green-700">Resultado confirmado</p>
                    {match.reportedByName && (
                      <p className="text-sm text-green-600 mt-2">
                        Reportado por: {match.reportedByName}
                        {match.confirmedByName && ` • Confirmado por: ${match.confirmedByName}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Formulario de puntuación */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Juegos Equipo 1
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="5"
                          value={formData.team1Games}
                          onChange={(e) => handleGamesChange('team1', e.target.value)}
                          className={errors.games ? "border-red-300" : ""}
                          disabled={match.round.isClosed || (!canReport && !canConfirm && !canEdit)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Juegos Equipo 2
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="5"
                          value={formData.team2Games}
                          onChange={(e) => handleGamesChange('team2', e.target.value)}
                          className={errors.games ? "border-red-300" : ""}
                          disabled={match.round.isClosed || (!canReport && !canConfirm && !canEdit)}
                        />
                      </div>
                    </div>

                    {errors.games && (
                      <p className="text-red-600 text-sm">{errors.games}</p>
                    )}

                    {/* Tie-break */}
                    {showTiebreak && (
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Resultado Tie-break (ej: 7-5)
                        </label>
                        <Input
                          type="text"
                          placeholder="7-5"
                          value={formData.tiebreakScore}
                          onChange={(e) => setFormData({...formData, tiebreakScore: e.target.value})}
                          className={errors.tiebreak ? "border-red-300" : ""}
                          disabled={match.round.isClosed || (!canReport && !canConfirm && !canEdit)}
                        />
                        {errors.tiebreak && (
                          <p className="text-red-600 text-sm mt-1">{errors.tiebreak}</p>
                        )}
                      </div>
                    )}

                    {/* Información */}
                    {formData.team1Games === 4 && formData.team2Games === 4 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex items-center gap-2 text-blue-700">
                          <Info className="h-4 w-4" />
                          <span className="text-sm">
                            Empate 4-4: se registrará como 5-4 para el ganador del tie-break
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Botones de acción */}
                    <div className="flex gap-2 pt-4">
                      {canReport && (
                        <Button
                          onClick={() => handleSubmit('report')}
                          disabled={isPending || match.round.isClosed}
                          className="flex-1"
                        >
                          {isPending ? "Reportando..." : "Reportar Resultado"}
                        </Button>
                      )}
                      
                      {canConfirm && (
                        <Button
                          onClick={() => handleSubmit('confirm')}
                          disabled={isPending || match.round.isClosed}
                          className="flex-1"
                        >
                          {isPending ? "Confirmando..." : "Confirmar Resultado"}
                        </Button>
                      )}

                      {canEdit && (
                        <>
                          <Button
                            onClick={() => handleSubmit('admin_force')}
                            disabled={isPending}
                            className="flex-1"
                          >
                            {isPending ? "Guardando..." : "Forzar Resultado"}
                          </Button>
                          {hasResult && (
                            <Button
                              onClick={handleDelete}
                              disabled={isPending}
                              variant="outline"
                              className="px-3"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Estado actual */}
                    {match.reportedById && !match.isConfirmed && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        {match.reportedById === currentPlayerId ? (
                          "Has reportado este resultado. Esperando confirmación de otro jugador."
                        ) : (
                          `${match.reportedByName} ha reportado este resultado. ${canConfirm ? 'Puedes confirmarlo si estás de acuerdo.' : ''}`
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Mi posición */}
            {getMyPosition() && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    Mi Posición
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      #{getMyPosition()?.position}
                    </div>
                    <div className="text-sm text-gray-600">
                      {getMyPosition()?.points.toFixed(1)} puntos
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Racha: {getMyPosition()?.streak || 0}
                      {getMyPosition()?.usedComodin && " • Comodín usado"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Clasificación del grupo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-500" />
                  Grupo {match.group.number}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {match.group.players.map((player, index) => (
                    <div key={player.id} className={`flex items-center justify-between p-2 rounded ${
                      player.id === currentPlayerId ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {player.position}
                        </div>
                        <span className={`text-sm font-medium ${
                          player.id === currentPlayerId ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {player.name.length > 12 ? player.name.substring(0, 12) + '...' : player.name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        {player.points.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Reglas rápidas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-green-500" />
                  Reglas Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>• Mínimo 4 juegos para ganar</p>
                <p>• Diferencia de 2 juegos</p>
                <p>• Si 4-4: tie-break a 7 puntos</p>
                <p>• +1 punto por juego ganado</p>
                <p>• +1 extra por ganar el set</p>
                <p>• +2 por racha consecutiva</p>
              </CardContent>
            </Card>