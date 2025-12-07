// app/admin/rounds/[id]/RoundDetailClient.tsx - CON SOPORTE GRUPOS SKIPPED
"use client";

import { useMemo, useState, useEffect } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import MatchGenerationPanel from "@/components/MatchGenerationPanel";
import GroupManagementPanel from "@/components/GroupManagementPanel";
import ManualGroupManager from "@/components/ManualGroupManager";
import CloseRoundButton from "@/components/CloseRoundButton";
import ReopenRoundButton from "@/components/ReopenRoundButton";
import EditRoundDatesDialog from "@/components/EditRoundDatesDialog";
import DeleteRoundDialog from "@/components/DeleteRoundDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Users,
  CheckCircle,
  Clock,
  ArrowLeft,
  Plus,
  Settings,
  Send,
  Shield,
  Ban,
  XCircle,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  Edit,
  Trash2,
} from "lucide-react";
import { format, differenceInDays, isAfter, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";

type GroupStatus = "PENDING" | "IN_PROGRESS" | "PLAYED" | "SKIPPED" | "POSTPONED";

type Match = {
  id: string;
  setNumber: number;
  team1Player1Id: string;
  team1Player2Id: string;
  team2Player1Id: string;
  team2Player2Id: string;
  team1Games: number | null;
  team2Games: number | null;
  tiebreakScore: string | null;
  isConfirmed: boolean;
  status?: string | null;
  // Fechas de programación a nivel de set (si las usas)
  proposedDate?: string | null;
  acceptedDate?: string | null;
  groupNumber: number;
  groupStatus?: GroupStatus;
};

export default function RoundDetailClient({
  round,
  eligiblePlayers,
}: {
  round: any;
  eligiblePlayers: any[];
}) {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<"all" | "pending" | "completed">("all");
  const [useManualManager, setUseManualManager] = useState<boolean>(true);
  const [showEditDatesDialog, setShowEditDatesDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const allMatches: Match[] = round.groups.flatMap((group: any) =>
    (group.matches || []).map((match: any) => ({
      ...match,
      groupNumber: group.number,
      groupStatus: group.status as GroupStatus | undefined,
    }))
  );

  // Evitar drift SSR/CSR en contadores relativos al “ahora”
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const now = mounted ? new Date() : new Date(round.startDate);

  const daysToEnd = differenceInDays(new Date(round.endDate), now);
  const daysToStart = differenceInDays(new Date(round.startDate), now);

  const status =
    round.isClosed
      ? "closed"
      : isBefore(now, new Date(round.startDate))
      ? "upcoming"
      : isAfter(now, new Date(round.endDate))
      ? "overdue"
      : "active";

  const totalSets = allMatches.length;
  const totalPartidos = Math.ceil(totalSets / 3);
  const completedSets = allMatches.filter((m) => m.isConfirmed).length;

  // Programados: consideramos SCHEDULED o acceptedDate definida
  const scheduledSets = allMatches.filter(
    (m) => m.status === "SCHEDULED" || !!m.acceptedDate
  ).length;

  // ✅ Conteo por estado de grupo (faltaba IN_PROGRESS)
  const groupsByStatus = useMemo(() => {
  const counts: Record<GroupStatus, number> & { total: number } = {
    PLAYED: 0,
    SKIPPED: 0,
    PENDING: 0,
    POSTPONED: 0,
    IN_PROGRESS: 0,
    total: round.groups.length,
  };

  for (const group of round.groups ?? []) {
    const st: GroupStatus = group.status ?? "PENDING";
    counts[st] += 1; // ya no hace falta @ts-expect-error
  }

  return counts;
}, [round.groups]);

  const filteredMatches = allMatches.filter((match) => {
    switch (selectedFilter) {
      case "pending":
        return !match.isConfirmed;
      case "completed":
        return match.isConfirmed;
      default:
        return true;
    }
  });

  const breadcrumbItems = [
    { label: "Inicio", href: "/dashboard" },
    { label: "Admin", href: "/admin" },
    { label: "Rondas", href: "/admin/rounds" },
    { label: `Ronda ${round.number}`, current: true },
  ];

  const getPlayerName = (playerId: string): string => {
    for (const group of round.groups) {
      const gp = (group.players || []).find((p: any) => p.player.id === playerId);
      if (gp) return gp.player.name;
    }
    return "Jugador desconocido";
  };

  // Helper visual de estado de grupo
  const getGroupStatusInfo = (status: GroupStatus) => {
    switch (status) {
      case "PLAYED":
        return { label: "Jugado", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle };
      case "SKIPPED":
        return { label: "No Disputado", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle };
      case "POSTPONED":
        return { label: "Prórroga", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock };
      case "IN_PROGRESS":
        return { label: "En Curso", color: "bg-blue-100 text-blue-700 border-blue-200", icon: PlayCircle };
      default:
        return { label: "Pendiente", color: "bg-gray-100 text-gray-700 border-gray-200", icon: PauseCircle };
    }
  };

  // Marcar grupo como SKIPPED (ajusta la ruta si en backend usas /api/rounds/[id]/groups/[groupId]/skip)
  const handleMarkAsSkipped = async (groupId: string, reason: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        window.location.reload();
      } else {
        alert("Error al marcar grupo como no disputado");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error de conexión");
    }
  };

  const mgrGroups = round.groups.map((group: any) => ({
    id: group.id,
    number: group.number,
    level: group.level ?? 0,
    status: group.status as GroupStatus | undefined,
    players: (group.players || []).map((gp: any) => ({
      id: gp.player.id,
      name: gp.player.name,
      position: gp.position,
    })),
  }));

  const availablePlayersList = eligiblePlayers.map((p: any) => ({
    id: p.id ?? p.player?.id ?? p.playerId,
    name: p.name ?? p.player?.name ?? p.playerName ?? "Jugador",
  }));

  const onGroupsSaved = async () => {
    window.location.reload();
  };

  // ========= Programación de partidos por grupo (admin) =========
  type AdminScheduleState = Record<
    string,
    {
      inputValue: string; // "YYYY-MM-DDTHH:mm"
      loading: boolean;
      msg?: { type: "success" | "error"; text: string };
    }
  >;

  function toLocalInputValue(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mi = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function fromLocalInputValue(value: string): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  const initialAdminState: AdminScheduleState = useMemo(() => {
    const obj: AdminScheduleState = {};
    for (const g of round.groups) {
      const first = g.matches?.[0];
      let baseDate = "";
      if (first?.acceptedDate) baseDate = toLocalInputValue(new Date(first.acceptedDate));
      else if (first?.proposedDate) baseDate = toLocalInputValue(new Date(first.proposedDate));
      obj[g.id] = { inputValue: baseDate, loading: false };
    }
    return obj;
  }, [round.groups]);

  const [adminSchedule, setAdminSchedule] = useState<AdminScheduleState>(initialAdminState);

  const handlePropose = async (groupId: string) => {
    const st = adminSchedule[groupId];
    const date = fromLocalInputValue(st?.inputValue || "");
    if (!date) {
      setAdminSchedule((s) => ({ ...s, [groupId]: { ...s[groupId], msg: { type: "error", text: "Selecciona una fecha válida." } } }));
      return;
    }
    setAdminSchedule((s) => ({ ...s, [groupId]: { ...s[groupId], loading: true, msg: undefined } }));

    try {
      const response = await fetch(`/api/parties/${groupId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedDate: date.toISOString(), message: "Fecha propuesta por administrador" }),
      });
      const data = await response.json();
      setAdminSchedule((s) => ({
        ...s,
        [groupId]: {
          ...s[groupId],
          loading: false,
          msg: { type: data.success ? "success" : "error", text: data.message || (data.success ? "Propuesta enviada." : "Error al proponer.") },
        },
      }));
      if (data.success) setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Error proposing date:", error);
      setAdminSchedule((s) => ({ ...s, [groupId]: { ...s[groupId], loading: false, msg: { type: "error", text: "Error de conexión" } } }));
    }
  };

  const handleForceSchedule = async (groupId: string) => {
    const st = adminSchedule[groupId];
    const date = fromLocalInputValue(st?.inputValue || "");
    if (!date) {
      setAdminSchedule((s) => ({ ...s, [groupId]: { ...s[groupId], msg: { type: "error", text: "Selecciona una fecha válida." } } }));
      return;
    }
    setAdminSchedule((s) => ({ ...s, [groupId]: { ...s[groupId], loading: true, msg: undefined } }));

    try {
      const response = await fetch(`/api/parties/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "admin_force_schedule", adminAction: true, forcedDate: date.toISOString() }),
      });
      const data = await response.json();
      setAdminSchedule((s) => ({
        ...s,
        [groupId]: {
          ...s[groupId],
          loading: false,
          msg: { type: data.success ? "success" : "error", text: data.message || (data.success ? "Partido programado (forzado por admin)." : "Error al forzar programación.") },
        },
      }));
      if (data.success) setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Error forcing schedule:", error);
      setAdminSchedule((s) => ({ ...s, [groupId]: { ...s[groupId], loading: false, msg: { type: "error", text: "Error de conexión" } } }));
    }
  };

  const handleCancel = async (groupId: string) => {
    setAdminSchedule((s) => ({ ...s, [groupId]: { ...s[groupId], loading: true, msg: undefined } }));
    try {
      const response = await fetch(`/api/parties/${groupId}`, { method: "DELETE" });
      const data = await response.json();
      setAdminSchedule((s) => ({
        ...s,
        [groupId]: {
          ...s[groupId],
          loading: false,
          msg: { type: data.success ? "success" : "error", text: data.message || (data.success ? "Fecha cancelada." : "Error al cancelar fecha.") },
        },
      }));
      if (data.success) setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Error canceling date:", error);
      setAdminSchedule((s) => ({ ...s, [groupId]: { ...s[groupId], loading: false, msg: { type: "error", text: "Error de conexión" } } }));
    }
  };

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-6">
      <Breadcrumbs items={breadcrumbItems} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">
            Ronda {round.number} - {round.tournament.title}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-gray-600">
              {format(new Date(round.startDate), "d 'de' MMMM", { locale: es })} -{" "}
              {format(new Date(round.endDate), "d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEditDatesDialog(true)}
              className="h-7"
            >
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/admin/rounds">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Rondas
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/admin/tournaments/${round.tournament.id}`}>Ver Torneo</Link>
          </Button>
        </div>
      </div>

      {/* Estado + métricas */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Estado</span>
              </div>
              <div>
                {status === "closed" && <Badge className="bg-gray-200 text-gray-800">Cerrada</Badge>}
                {status === "upcoming" && (
                  <Badge className="bg-blue-100 text-blue-700">
                    {mounted ? `Próxima (${daysToStart} días)` : "Próxima"}
                  </Badge>
                )}
                {status === "active" && (
                  <Badge className="bg-green-100 text-green-700">
                    {mounted ? `Activa (${daysToEnd} días restantes)` : "Activa"}
                  </Badge>
                )}
                {status === "overdue" && <Badge variant="destructive">Fuera de plazo</Badge>}
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="w-5 h-5 text-purple-600" />
                <span className="font-medium">Grupos</span>
              </div>
              <div className="text-2xl font-bold">{groupsByStatus.total}</div>
              <div className="flex items-center justify-center gap-2 mt-1 text-xs">
                <Badge className="bg-green-100 text-green-700">{groupsByStatus.PLAYED} jugados</Badge>
                {groupsByStatus.IN_PROGRESS > 0 && (
                  <Badge className="bg-blue-100 text-blue-700">{groupsByStatus.IN_PROGRESS} en curso</Badge>
                )}
                {groupsByStatus.SKIPPED > 0 && (
                  <Badge className="bg-red-100 text-red-700">{groupsByStatus.SKIPPED} no disputados</Badge>
                )}
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium">Sets Completados</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {completedSets}/{totalSets}
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Sets Programados</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{scheduledSets}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ✅ Panel de Gestión de Grupos No Disputados */}
      {!round.isClosed && groupsByStatus.SKIPPED > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-5 h-5" />
              Grupos No Disputados ({groupsByStatus.SKIPPED})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-red-700">
              Los siguientes grupos no completaron sus 3 sets y recibirán puntos técnicos al cerrar la ronda.
            </p>

            {round.groups
              .filter((g: any) => g.status === "SKIPPED")
              .map((group: any) => {
                const confirmedSets = group.matches?.filter((m: any) => m.isConfirmed).length || 0;
                return (
                  <div key={group.id} className="bg-white border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Grupo {group.number}</div>
                        <div className="text-sm text-gray-600">
                          {confirmedSets}/3 sets confirmados
                          {group.skippedReason && ` • ${group.skippedReason}`}
                        </div>
                      </div>
                      <Badge className="bg-red-100 text-red-700">No Disputado</Badge>
                    </div>
                  </div>
                );
              })}

            {/* 🔒 Política alineada con especificación del proyecto */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <strong>Al cerrar la ronda:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>
                  <strong>Puntos técnicos</strong>: Rondas 1–2 → <em>media de la jornada</em>; Rondas ≥3 →{" "}
                  <em>media personal</em>.
                </li>
                <li>
                  <strong>Racha</strong>: <em>congelada</em> (no suma ni se rompe).
                </li>
                <li>
                  <strong>Movimientos</strong>: jugadores <em>no se mueven</em> (grupo congelado).
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selector de modo de gestión de grupos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Gestión de Grupos (Admin)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              Modo actual:{" "}
              <Badge variant="outline" className="ml-1">
                {useManualManager ? "Manual (sin drag & drop)" : "Panel clásico"}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant={useManualManager ? "default" : "outline"} size="sm" onClick={() => setUseManualManager(true)}>
                Manual
              </Button>
              <Button variant={!useManualManager ? "default" : "outline"} size="sm" onClick={() => setUseManualManager(false)}>
                Panel clásico
              </Button>
            </div>
          </div>

          {useManualManager ? (
            <ManualGroupManager
              roundId={round.id}
              initialGroups={round.groups.map((group: any) => ({
                id: group.id,
                level: group.level ?? 0,
                players: (group.players || []).map((gp: any) => ({
                  id: gp.player.id,
                  name: gp.player.name,
                })),
              }))}
              availablePlayers={availablePlayersList}
              onSave={onGroupsSaved}
            />
          ) : (
            <GroupManagementPanel
              roundId={round.id}
              roundNumber={round.number}
              tournament={{
                id: round.tournament.id,
                title: round.tournament.title,
                totalPlayers: eligiblePlayers.length,
              }}
              groups={mgrGroups}
              // si tu componente espera un número, deja length; si espera lista, pásale availablePlayersList
              availablePlayers={eligiblePlayers.length}
              isAdmin={true}
            />
          )}
        </CardContent>
      </Card>

      {/* Programación por grupo (Admin) */}
      {!round.isClosed && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Programación de Partidos (Admin)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600">
              Establece una fecha por grupo. Puedes <strong>proponer</strong> o <strong>forzar</strong> la
              programación (marca el partido como <em>SCHEDULED</em>). También puedes <strong>cancelar</strong> una
              fecha propuesta/aceptada.
            </div>

            <div className="space-y-3">
              {round.groups.map((g: any) => {
                const st = adminSchedule[g.id] || ({ inputValue: "", loading: false } as any);
                const first = g.matches?.[0];
                const info = first?.acceptedDate
                  ? `Programado: ${format(new Date(first.acceptedDate), "d MMM yyyy HH:mm", { locale: es })}`
                  : first?.proposedDate
                  ? `Propuesto: ${format(new Date(first.proposedDate), "d MMM yyyy HH:mm", { locale: es })}`
                  : "Sin fecha";

                return (
                  <div key={g.id} className="flex flex-col md:flex-row items-center gap-3 p-3 border rounded-lg bg-gray-50">
                    <div className="w-full md:w-40 shrink-0">
                      <Badge variant="outline" className="w-full justify-center">
                        Grupo {g.number}
                      </Badge>
                      <div className="text-xs text-gray-500 mt-1 text-center">{info}</div>
                    </div>

                    <input
                      type="datetime-local"
                      className="w-full md:w-64 border rounded-lg px-3 py-2"
                      value={st.inputValue || ""}
                      onChange={(e) => setAdminSchedule((s) => ({ ...s, [g.id]: { ...s[g.id], inputValue: e.target.value, msg: undefined } }))}
                      disabled={st.loading}
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={st.loading} onClick={() => handlePropose(g.id)}>
                        <Send className="w-4 h-4 mr-2" />
                        {st.loading ? "..." : "Proponer"}
                      </Button>
                      <Button size="sm" variant="default" disabled={st.loading} onClick={() => handleForceSchedule(g.id)}>
                        <Shield className="w-4 h-4 mr-2" />
                        {st.loading ? "..." : "Forzar programado"}
                      </Button>
                      <Button size="sm" variant="destructive" disabled={st.loading} onClick={() => handleCancel(g.id)}>
                        <Ban className="w-4 h-4 mr-2" />
                        {st.loading ? "..." : "Cancelar"}
                      </Button>
                    </div>

                    {st.msg && (
                      <div className={`text-sm ${st.msg.type === "success" ? "text-green-600" : "text-red-600"}`}>
                        {st.msg.text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generación de partidos */}
      <MatchGenerationPanel
        roundId={round.id}
        groups={round.groups.map((group: any) => ({
          id: group.id,
          number: group.number,
          level: group.level ?? 0,
          players: (group.players || []).map((gp: any) => ({
            id: gp.player.id,
            name: gp.player.name,
            position: gp.position,
          })),
          matches: (group.matches || []).map((m: any) => ({
            id: m.id,
            setNumber: m.setNumber,
          })),
        }))}
        isAdmin={true}
      />

      {/* Gestión de resultados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Gestión de Resultados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{totalSets}</div>
                <div className="text-sm text-gray-600">Sets totales</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{completedSets}</div>
                <div className="text-sm text-gray-600">Completados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{totalSets - completedSets}</div>
                <div className="text-sm text-gray-600">Pendientes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0}%
                </div>
                <div className="text-sm text-gray-600">Progreso</div>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <Button variant={selectedFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setSelectedFilter("all")}>
                  Todos ({totalSets})
                </Button>
                <Button variant={selectedFilter === "pending" ? "default" : "outline"} size="sm" onClick={() => setSelectedFilter("pending")}>
                  Pendientes ({totalSets - completedSets})
                </Button>
                <Button variant={selectedFilter === "completed" ? "default" : "outline"} size="sm" onClick={() => setSelectedFilter("completed")}>
                  Completados ({completedSets})
                </Button>
              </div>
              <div className="text-sm text-gray-500">{filteredMatches.length} sets mostrados</div>
            </div>

            {/* Lista de sets */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredMatches.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No hay sets que coincidan con el filtro seleccionado</p>
                </div>
              ) : (
                filteredMatches.map((match) => {
                  const hasResult = match.team1Games !== null && match.team2Games !== null;
                  const team1Score = match.team1Games ?? "-";
                  const team2Score = match.team2Games ?? "-";

                  return (
                    <div
                      key={match.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        match.isConfirmed
                          ? "bg-green-50 border-green-200"
                          : hasResult
                          ? "bg-yellow-50 border-yellow-200"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline" className="shrink-0">
                              Grupo {match.groupNumber} - Set {match.setNumber}
                            </Badge>
                            {match.isConfirmed && (
                              <Badge className="bg-green-100 text-green-700 shrink-0">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Confirmado
                              </Badge>
                            )}
                            {hasResult && !match.isConfirmed && (
                              <Badge className="bg-yellow-100 text-yellow-700 shrink-0">
                                <Clock className="w-3 h-3 mr-1" />
                                Por validar
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="truncate">
                                {getPlayerName(match.team1Player1Id)} + {getPlayerName(match.team1Player2Id)}
                              </span>
                              <span className="font-bold text-lg ml-2">{team1Score}</span>
                            </div>

                            <div className="text-center text-xs text-gray-400">vs</div>

                            <div className="flex items-center justify-between">
                              <span className="truncate">
                                {getPlayerName(match.team2Player1Id)} + {getPlayerName(match.team2Player2Id)}
                              </span>
                              <span className="font-bold text-lg ml-2">{team2Score}</span>
                            </div>
                          </div>

                          {match.tiebreakScore && <div className="text-xs text-blue-600 mt-1">Tie-break: {match.tiebreakScore}</div>}
                        </div>

                        <div className="ml-4 flex items-center gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/match/${match.id}`}>
                              {hasResult ? (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Ver
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4 mr-2" />
                                  Introducir
                                </>
                              )}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Acciones masivas */}
            {!round.isClosed && (
              <div className="flex flex-wrap gap-3 pt-4 border-t">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/results">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Validar Resultados
                  </Link>
                </Button>

                {totalSets - completedSets > 0 && (
                  <Button variant="outline" size="sm">
                    <Clock className="w-4 h-4 mr-2" />
                    Enviar recordatorios ({totalSets - completedSets} pendientes)
                  </Button>
                )}

                {completedSets === totalSets && (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Todos los sets completados — Lista para cerrar
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Acciones de administración - Ronda Abierta */}
      {!round.isClosed && (
        <Card>
          <CardHeader>
            <CardTitle>Acciones de Administración</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link href="/admin/results">Validar Resultados</Link>
              </Button>

              <CloseRoundButton roundId={round.id} />

              {groupsByStatus.SKIPPED > 0 && (
                <Badge className="bg-red-100 text-red-700 px-3 py-2">
                  {groupsByStatus.SKIPPED} grupo(s) no disputado(s) — recibirán puntos técnicos
                </Badge>
              )}

              <Button variant="outline" asChild>
                <Link href="/admin/players">Gestionar Jugadores</Link>
              </Button>

              <Button variant="outline" asChild>
                <Link href={`/admin/rounds/${round.id}/comodines`}>Gestionar Comodines</Link>
              </Button>

              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar Ronda
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Acciones de administración - Ronda Cerrada */}
      {round.isClosed && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="w-5 h-5" />
              Ronda Cerrada - Acciones Administrativas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 mb-3">
                Esta ronda ha sido cerrada. Los movimientos de escalera y puntos han sido aplicados.
                Si necesitas hacer cambios, puedes reabrir la ronda.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 mb-3">
                <strong>⚠️ Advertencia:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Reabrir permitirá editar grupos, jugadores y resultados</li>
                  <li>Si existe una ronda siguiente generada, deberás ajustarla manualmente</li>
                  <li>Los rankings ya calculados permanecerán hasta que vuelvas a cerrar la ronda</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <ReopenRoundButton roundId={round.id} />

              <Button variant="outline" asChild>
                <Link href={`/admin/tournaments/${round.tournament.id}`}>
                  Ver Torneo
                </Link>
              </Button>

              <Button variant="outline" asChild>
                <Link href="/admin/rankings">
                  Ver Rankings
                </Link>
              </Button>

              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar Ronda
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diálogos */}
      <EditRoundDatesDialog
        open={showEditDatesDialog}
        onOpenChange={setShowEditDatesDialog}
        roundId={round.id}
        initialStartDate={new Date(round.startDate)}
        initialEndDate={new Date(round.endDate)}
        onSuccess={() => {
          router.refresh();
        }}
      />

      <DeleteRoundDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        roundId={round.id}
        roundNumber={round.number}
        tournamentId={round.tournament.id}
        isClosed={round.isClosed}
        totalGroups={round.groups.length}
        totalMatches={allMatches.length}
        confirmedMatches={completedSets}
      />
    </div>
  );
}
