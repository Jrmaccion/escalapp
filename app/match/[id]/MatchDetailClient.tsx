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
} from "lucide-react";
import MatchScheduling from "@/components/MatchScheduling";
import { MatchData } from "@/types/match";

type MatchDetailClientProps = {
  match: MatchData;
  currentPlayerId?: string | null;
  isAdmin: boolean;
};

export default function MatchDetailClient({
  match,
  currentPlayerId,
  isAdmin,
}: MatchDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    team1Games: match.team1Games || 0,
    team2Games: match.team2Games || 0,
    tiebreakScore: match.tiebreakScore || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTiebreak] = useState(Boolean(match.tiebreakScore));

  const isParticipant =
    !!currentPlayerId &&
    [
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id,
    ].includes(currentPlayerId);

  const canReport =
    isParticipant && !match.reportedById && !match.round.isClosed;
  const canConfirm =
    isParticipant &&
    match.reportedById &&
    !match.confirmedById &&
    !match.round.isClosed;
  const canEdit = isAdmin && !match.round.isClosed;
  const hasResult =
    match.team1Games !== null && match.team2Games !== null;

  const goBack = () => {
    // Si es admin, siempre redirigir a la página de detalle de la ronda
    if (isAdmin && match?.round?.id) {
      router.push(`/admin/rounds/${match.round.id}`);
      return;
    }
    
    // Para jugadores normales, usar historial o dashboard
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    const a = Number(formData.team1Games),
      b = Number(formData.team2Games);
    if (Number.isNaN(a) || Number.isNaN(b))
      e.score = "Los juegos deben ser números";
    if (a < 0 || a > 5 || b < 0 || b > 5)
      e.range = "Los juegos deben estar entre 0 y 5";
    const max = Math.max(a, b),
      diff = Math.abs(a - b);
    if (max < 4) e.min = "Un set se gana al llegar a 4";
    if (max > 5)
      e.max = "No puede superar 5-? (tie-break se registra como 5-4)";
    if (max === 4 && diff < 2)
      e.diff = "Diferencia mínima de 2 salvo 4–4 con tie-break";
    if (a === 4 && b === 4 && !formData.tiebreakScore.trim())
      e.tb = "Si hay 4–4 debes introducir tie-break";
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
        
        // Después de guardar exitosamente, redirigir según el tipo de usuario
        if (isAdmin) {
          router.push(`/admin/rounds/${match.round.id}`);
        } else {
          router.refresh(); // Para jugadores, solo refrescar la página
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="text-sm text-blue-600 hover:underline inline-flex items-center"
            type="button"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </button>
          <div className="text-gray-600 text-sm">
            Ronda {match.round.number} · {match.tournament.title}
          </div>
        </div>

        {/* Cabecera con información del set */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Set {match.setNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="text-right sm:text-center">
                <div className="font-medium">
                  {match.team1Player1Name} + {match.team1Player2Name}
                </div>
              </div>
              <div className="text-center text-gray-500">vs</div>
              <div className="sm:text-left">
                <div className="font-medium">
                  {match.team2Player1Name} + {match.team2Player2Name}
                </div>
              </div>
            </div>

            {/* Información contextual del partido */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">Información del Set</p>
                  <p className="text-blue-700">
                    Este es el Set {match.setNumber} de un partido de 3 sets con rotación de jugadores. 
                    Los 4 jugadores participan en los 3 sets con diferentes combinaciones de equipos.
                  </p>
                </div>
              </div>
            </div>

            {/* Programación de set */}
            <MatchScheduling
              match={{
                id: match.id,
                setNumber: match.setNumber,
                status: match.status,
                proposedDate: match.proposedDate,
                acceptedDate: match.acceptedDate,
                proposedBy: match.proposedById || null,
                acceptedCount: match.acceptedBy?.length || 0,
                team1Player1Name: match.team1Player1Name,
                team1Player2Name: match.team1Player2Name,
                team2Player1Name: match.team2Player1Name,
                team2Player2Name: match.team2Player2Name,
                team1Games: match.team1Games,
                team2Games: match.team2Games,
                isConfirmed: match.isConfirmed,
              }}
              currentUserId={currentPlayerId || ""}
              isParticipant={
                !!currentPlayerId &&
                [
                  match.team1Player1Id,
                  match.team1Player2Id,
                  match.team2Player1Id,
                  match.team2Player2Id,
                ].includes(currentPlayerId)
              }
              onUpdate={() => router.refresh()}
            />
          </CardContent>
        </Card>

        {/* Resultado del Set */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Resultado del Set
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                {errors.general}
              </div>
            )}

            {hasResult && match.isConfirmed && !canEdit ? (
              <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <div className="text-2xl font-bold text-green-900 mb-2">
                  {formatExistingScore()}
                </div>
                <p className="text-green-700">Resultado del set confirmado</p>
                {match.reportedByName && (
                  <p className="text-sm text-green-600 mt-2">
                    Reportado por: {match.reportedByName}
                    {match.confirmedByName &&
                      ` • Confirmado por: ${match.confirmedByName}`}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
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
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Calendar className="w-4 h-4" />
                    Tie-break (obligatorio si 4–4)
                  </label>
                  <Input
                    placeholder="Ej. 7–5"
                    value={formData.tiebreakScore}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        tiebreakScore: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Mostrar errores de validación */}
                {Object.keys(errors).filter(k => k !== 'general').length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <ul className="text-red-600 text-sm space-y-1">
                      {Object.entries(errors).filter(([k]) => k !== 'general').map(([key, error]) => (
                        <li key={key}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {canReport && (
                    <Button
                      onClick={() => submit("report")}
                      disabled={isPending}
                    >
                      Reportar resultado del set
                    </Button>
                  )}
                  {canConfirm && (
                    <Button
                      variant="secondary"
                      onClick={() => submit("confirm")}
                      disabled={isPending}
                    >
                      Confirmar resultado del set
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="outline"
                      onClick={() => submit("admin_edit")}
                      disabled={isPending}
                    >
                      Guardar como admin
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}