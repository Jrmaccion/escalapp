// app/match/[id]/MatchDetailClient.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
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
  Lock,
  Clock,
} from "lucide-react";
import PartyScheduling from "@/components/PartyScheduling";
import { MatchData } from "@/types/match";

type MatchDetailClientProps = {
  match: MatchData;
  currentPlayerId?: string | null;
  currentUserId?: string;
  isAdmin: boolean;
  // Datos del partido completo para programación (3 sets)
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

  // ====== Ventana de edición (bloqueo temporal) ======
  // La fecha efectiva del partido es la aceptada (acceptedDate) del set/partido.
  // Editar solo está permitido para jugadores a partir de +90 minutos de esa fecha.
  const scheduledISO =
    match.acceptedDate || partyData?.acceptedDate || null;

  const madridFmt = (d: Date) =>
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);

  const { isScheduled, lockUntil, isAfterLock } = useMemo(() => {
    const isScheduled = Boolean(scheduledISO);
    if (!isScheduled) {
      return { isScheduled: false, lockUntil: null as Date | null, isAfterLock: false };
    }
    const scheduled = new Date(scheduledISO as string);
    const lockUntil = new Date(scheduled.getTime() + 90 * 60 * 1000); // +90 min
    const isAfterLock = new Date() >= lockUntil;
    return { isScheduled: true, lockUntil, isAfterLock };
  }, [scheduledISO]);

  // ====== Permisos por rol/tiempo/estado de ronda ======
  const roundOpen = !match.round.isClosed;

  const canTimeWindow = isAdmin || (isScheduled && isAfterLock);
  const canReport =
    isParticipant && !match.reportedById && roundOpen && canTimeWindow;
  const canConfirm =
    isParticipant &&
    match.reportedById &&
    !match.confirmedById &&
    roundOpen &&
    canTimeWindow;
  const canAdminEdit = isAdmin && roundOpen;

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
    const a = Number(formData.team1Games),
      b = Number(formData.team2Games);
    if (Number.isNaN(a) || Number.isNaN(b)) e.score = "Los juegos deben ser números";
    if (a < 0 || a > 5 || b < 0 || b > 5) e.range = "Los juegos deben estar entre 0 y 5";
    const max = Math.max(a, b),
      diff = Math.abs(a - b);
    if (max < 4) e.min = "Un set se gana al llegar a 4";
    if (max > 5) e.max = "No puede superar 5-? (el tie-break se registra como 5-4)";
    if (max === 4 && diff < 2)
      e.diff = "Diferencia mínima de 2 salvo 4-4 con tie-break";
    if (a === 4 && b === 4 && !formData.tiebreakScore.trim())
      e.tb = "Si hay 4-4 debes introducir el tie-break (p. ej. 7-5)";
    return e;
  };

  const submit = (action: "report" | "confirm" | "admin_edit") => {
    // Bloqueo extra por si alguien manipula el DOM
    if (!canAdminEdit && !canTimeWindow) {
      setErrors({
        general:
          "La edición está bloqueada hasta 90 minutos después de la hora programada.",
      });
      return;
    }

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

  const inputsDisabled = !canAdminEdit && !canTimeWindow;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl space-y-6">
        {/* Barra superior */}
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

        {/* Programación del partido (los 3 sets) */}
        {partyData && (
          <PartyScheduling
            party={partyData}
            currentUserId={currentUserId || ""}
            isParticipant={isParticipant}
            onUpdate={handlePartyUpdate}
          />
        )}

        {/* Avisos de bloqueo/estado de programación */}
        {!isAdmin && (
          <Card>
            <CardContent className="p-4">
              {!isScheduled ? (
                <div className="flex items-start gap-2 text-orange-700">
                  <Lock className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Edición bloqueada: partido sin programar</p>
                    <p>
                      Primero hay que proponer/aceptar fecha y hora del partido para poder introducir resultados.
                    </p>
                  </div>
                </div>
              ) : !isAfterLock ? (
                <div className="flex items-start gap-2 text-blue-700">
                  <Clock className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Edición bloqueada temporalmente</p>
                    <p>
                      La edición se habilitará{" "}
                      <strong>90 minutos después</strong> de la hora programada:{" "}
                      <strong>{madridFmt(lockUntil as Date)}</strong>.
                    </p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Cabecera con información del set actual */}
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

            {/* Info contextual */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">Información del Set</p>
                  <p className="text-blue-700">
                    Este es el Set {match.setNumber} de un partido de 3 sets con rotación de jugadores. 
                    La fecha se programa para el partido completo (aplica a los 3 sets).
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resultado del set (con bloqueo por tiempo/rol) */}
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

            {hasResult && match.isConfirmed && !canAdminEdit ? (
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
                      disabled={inputsDisabled}
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
                      disabled={inputsDisabled}
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Calendar className="w-4 h-4" />
                    Tie-break (obligatorio si 4-4)
                  </label>
                  <Input
                    placeholder="Ej. 7-5"
                    value={formData.tiebreakScore}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        tiebreakScore: e.target.value,
                      }))
                    }
                    disabled={inputsDisabled}
                  />
                </div>

                {/* Errores de validación */}
                {Object.keys(errors)
                  .filter((k) => k !== "general")
                  .length > 0 && (
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

                <div className="flex flex-wrap gap-2">
                  {canReport && (
                    <Button onClick={() => submit("report")} disabled={isPending}>
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
                  {canAdminEdit && (
                    <Button
                      variant="outline"
                      onClick={() => submit("admin_edit")}
                      disabled={isPending}
                    >
                      Guardar como admin
                    </Button>
                  )}
                  {!canAdminEdit && !canTimeWindow && (
                    <span className="text-sm text-gray-600">
                      Edición disponible a partir de:{" "}
                      <strong>
                        {isScheduled && lockUntil ? madridFmt(lockUntil) : "—"}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumen de los 3 sets del partido */}
        {partyData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Sets del partido (vista general)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {partyData.sets
                .slice()
                .sort((a, b) => a.setNumber - b.setNumber)
                .map((s) => {
                  const badge = s.isConfirmed
                    ? { text: "Confirmado", cls: "bg-green-100 text-green-700" }
                    : s.hasResult
                    ? { text: "Por confirmar", cls: "bg-yellow-100 text-yellow-700" }
                    : { text: "Sin resultado", cls: "bg-gray-100 text-gray-700" };

                  return (
                    <div
                      key={s.id}
                      className="border rounded-lg p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">Set {s.setNumber}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${badge.cls}`}>
                            {badge.text}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700">
                          {s.team1Player1Name} + {s.team1Player2Name} vs{" "}
                          {s.team2Player1Name} + {s.team2Player2Name}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {s.id === match.id ? (
                          <Button size="sm" disabled variant="default">
                            Estás en este set
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/match/${s.id}`}>Abrir</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        )}

        {/* Enlaces adicionales */}
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
