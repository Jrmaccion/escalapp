// app/match/[id]/MatchDetailClient.tsx - FLUJO SIMPLIFICADO SIN LÓGICA CONFUSA
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Calendar,
  Users,
  CheckCircle,
  Trophy,
  Info,
  Clock,
  Play,
  Save
} from "lucide-react";
import PartyScheduling from "@/components/PartyScheduling";
import { MatchData } from "@/types/match";

type MatchDetailClientProps = {
  match: MatchData;
  currentPlayerId?: string | null;
  currentUserId?: string;
  isAdmin: boolean;
  partyData?: {
    groupId: string;
    groupNumber: number;
    roundNumber: number;
    players: string[];
    sets: Array<{
      id: string;
      setNumber: number;
      team1Player1Name: string;
      team1Player2Name: string;
      team2Player1Name: string;
      team2Player2Name: string;
      hasResult: boolean;
      isConfirmed: boolean;
    }>;
    scheduleStatus: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED";
    proposedDate: string | null;
    acceptedDate: string | null;
    proposedBy: string | null;
    acceptedCount: number;
    proposedByCurrentUser?: boolean;
  };
};

// Estados simplificados del partido
type MatchState = 
  | 'NOT_PLAYED'        // Sin resultado
  | 'REPORTED'          // Un jugador reportó resultado
  | 'CONFIRMED'         // Resultado confirmado por ambos
  | 'ADMIN_ONLY'        // Solo admin puede editar
  | 'ROUND_CLOSED';     // Ronda cerrada, no editable

export default function MatchDetailClient({
  match,
  currentPlayerId,
  currentUserId,
  isAdmin,
  partyData,
}: MatchDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    team1Games: match.team1Games ?? 0,
    team2Games: match.team2Games ?? 0,
    tiebreakScore: match.tiebreakScore ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isParticipant =
    !!currentPlayerId &&
    [
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id,
    ].includes(currentPlayerId);

  // LÓGICA SIMPLIFICADA: Solo 5 estados claros
  const getMatchState = (): MatchState => {
    if (match.round.isClosed) return 'ROUND_CLOSED';
    if (match.isConfirmed) return 'CONFIRMED';
    if (match.reportedById && match.team1Games !== null) return 'REPORTED';
    if (!isParticipant && !isAdmin) return 'ADMIN_ONLY';
    return 'NOT_PLAYED';
  };

  const matchState = getMatchState();
  const hasResult = match.team1Games != null && match.team2Games != null;

  const goBack = () => {
    if (isAdmin && match?.round?.id) {
      router.push(`/admin/rounds/${match.round.id}`);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    const a = Number(formData.team1Games);
    const b = Number(formData.team2Games);
    
    if (Number.isNaN(a) || Number.isNaN(b)) {
      e.score = "Los juegos deben ser números";
      return e;
    }
    
    if (a < 0 || a > 5 || b < 0 || b > 5) {
      e.range = "Los juegos deben estar entre 0 y 5";
      return e;
    }
    
    const max = Math.max(a, b);
    const diff = Math.abs(a - b);
    
    if (max < 4) {
      e.min = "Un set se gana al llegar a 4 juegos";
      return e;
    }
    
    if (max > 5) {
      e.max = "Máximo 5 juegos (5-4 con tie-break)";
      return e;
    }
    
    if (max === 4 && diff < 2) {
      e.diff = "Diferencia mínima de 2 juegos, salvo 4-4 con tie-break";
      return e;
    }
    
    if (a === 4 && b === 4 && !formData.tiebreakScore.trim()) {
      e.tb = "Si hay 4-4 debes introducir el tie-break (ej: 7-5)";
      return e;
    }
    
    return e;
  };

  const submit = (action: "report" | "confirm" | "admin_edit") => {
    const e = validateForm();
    setErrors(e);
    if (Object.keys(e).length) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/matches/${match.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team1Games: Number(formData.team1Games),
            team2Games: Number(formData.team2Games),
            tiebreakScore: formData.tiebreakScore || null,
            action,
          }),
        });
        
        const data = await response.json();
        if (!response.ok) {
          setErrors({ general: data?.error || "Error al guardar" });
          return;
        }

        if (isAdmin) {
          router.push(`/admin/rounds/${match.round.id}`);
        } else {
          router.refresh();
        }
      } catch {
        setErrors({ general: "Error de conexión" });
      }
    });
  };

  const formatExistingScore = () => {
    if (!hasResult) return "Sin resultado";
    const base = `${match.team1Games}-${match.team2Games}`;
    return match.tiebreakScore ? `${base} (TB ${match.tiebreakScore})` : base;
  };

  const handlePartyUpdate = () => {
    router.refresh();
  };

  // COMPONENTES PARA CADA ESTADO
  const renderStateCard = () => {
    switch (matchState) {
      case 'ROUND_CLOSED':
        return (
          <Card className="border-gray-300 bg-gray-50">
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Ronda Cerrada</h3>
              <p className="text-gray-600 mb-4">Esta ronda ha finalizado y no se pueden hacer cambios.</p>
              {hasResult && (
                <div className="text-2xl font-bold text-gray-700">
                  {formatExistingScore()}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'CONFIRMED':
        return (
          <Card className="border-green-300 bg-green-50">
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">Set Confirmado</h3>
              <div className="text-3xl font-bold text-green-700 mb-4">
                {formatExistingScore()}
              </div>
              <p className="text-green-600">
                Reportado por: {match.reportedByName}
                {match.confirmedByName && ` • Confirmado por: ${match.confirmedByName}`}
              </p>
            </CardContent>
          </Card>
        );

      case 'REPORTED':
        return (
          <Card className="border-yellow-300 bg-yellow-50">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <Clock className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Esperando Confirmación</h3>
                <div className="text-2xl font-bold text-yellow-700 mb-2">
                  {formatExistingScore()}
                </div>
                <p className="text-yellow-600">
                  Reportado por: {match.reportedByName}
                </p>
              </div>

              {isParticipant && currentUserId !== match.reportedById && (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-100 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 mb-3">
                      ¿Confirmas que este resultado es correcto?
                    </p>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => submit("confirm")}
                        disabled={isPending}
                        className="flex-1"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirmar Resultado
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setErrors({ general: "Contacta con el jugador que reportó o con un administrador para corregir el resultado" })}
                        className="flex-1"
                      >
                        Reportar Error
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="border-t pt-4">
                  <Button
                    onClick={() => submit("admin_edit")}
                    disabled={isPending}
                    variant="outline"
                    className="w-full"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Confirmar como Admin
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'ADMIN_ONLY':
        return (
          <Card className="border-blue-300 bg-blue-50">
            <CardContent className="p-6 text-center">
              <Info className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Solo Jugadores del Set</h3>
              <p className="text-blue-600">
                Solo los jugadores de este set pueden reportar resultados.
              </p>
            </CardContent>
          </Card>
        );

      case 'NOT_PLAYED':
      default:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                Reportar Resultado del Set
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                  {errors.general}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Juegos Equipo 1
                  </label>
                  <Input
                    type="number"
                    value={formData.team1Games}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        team1Games: Number(e.target.value),
                      }))
                    }
                    min={0}
                    max={5}
                    className="text-center text-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Juegos Equipo 2
                  </label>
                  <Input
                    type="number"
                    value={formData.team2Games}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        team2Games: Number(e.target.value),
                      }))
                    }
                    min={0}
                    max={5}
                    className="text-center text-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Tie-break (obligatorio si 4-4)
                </label>
                <Input
                  placeholder="Ej: 7-5"
                  value={formData.tiebreakScore}
                  onChange={(e) =>
                    setFormData((s) => ({
                      ...s,
                      tiebreakScore: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Errores de validación */}
              {Object.keys(errors).filter(k => k !== "general").length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded">
                  <ul className="text-red-600 text-sm space-y-1">
                    {Object.entries(errors)
                      .filter(([k]) => k !== "general")
                      .map(([key, error]) => (
                        <li key={key}>• {error}</li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-3">
                {isParticipant && (
                  <Button 
                    onClick={() => submit("report")} 
                    disabled={isPending}
                    className="flex-1"
                    size="lg"
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Reportar Resultado
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => submit("admin_edit")}
                    disabled={isPending}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Guardar como Admin
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl space-y-6">
        {/* Navegación */}
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="text-sm text-blue-600 hover:underline inline-flex items-center"
            type="button"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </button>
          <div className="text-gray-600 text-sm">
            Ronda {match.round.number} • {match.tournament.title}
          </div>
        </div>

        {/* Programación del partido (si existe) */}
        {partyData && (
          <PartyScheduling
            party={partyData}
            currentUserId={currentUserId || ""}
            isParticipant={isParticipant}
            onUpdate={handlePartyUpdate}
          />
        )}

        {/* Información del set */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Set {match.setNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="font-medium text-blue-800">
                  {match.team1Player1Name} + {match.team1Player2Name}
                </div>
              </div>
              <div className="text-center text-gray-500 text-sm">vs</div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="font-medium text-red-800">
                  {match.team2Player1Name} + {match.team2Player2Name}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">Sistema de Puntuación</p>
                  <ul className="text-blue-700 space-y-1">
                    <li>• Cada jugador obtiene 1 punto por cada juego ganado</li>
                    <li>• El equipo ganador del set obtiene 1 punto adicional</li>
                    <li>• Si hay empate 4-4, se juega tie-break</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estado del partido - Card principal */}
        {renderStateCard()}

        {/* Enlaces de navegación */}
        <div className="flex justify-center space-x-4 text-sm">
          <Link href="/mi-grupo" className="text-blue-600 hover:underline">
            Ver mi grupo completo
          </Link>
          {isAdmin && (
            <Link
              href={`/admin/rounds/${match.round.id}`}
              className="text-blue-600 hover:underline"
            >
              Gestión de ronda
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}