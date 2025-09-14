// components/PartyScheduling.tsx - VERSIÓN COMPLETA CON TODAS LAS FUNCIONALIDADES
"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  CheckCircle,
  X,
  Users,
  AlertTriangle,
  CalendarPlus,
  Play,
  Trophy,
  RefreshCw,
  Shield,
  Zap,
  Ban,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Tipos extendidos para incluir funcionalidad admin
export type PartyInfo = {
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

type PartySchedulingProps = {
  party?: PartyInfo;
  groupId?: string;
  currentUserId: string;
  isParticipant: boolean;
  isAdmin?: boolean;
  onUpdate: () => void;
  showCompactView?: boolean;
  enableRefresh?: boolean;
};

export default function PartyScheduling({
  party: externalParty,
  groupId,
  currentUserId,
  isParticipant,
  isAdmin = false,
  onUpdate,
  showCompactView = false,
  enableRefresh = true
}: PartySchedulingProps) {
  const [isPending, startTransition] = useTransition();
  const [showDateForm, setShowDateForm] = useState(false);
  const [showAdminControls, setShowAdminControls] = useState(false);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [internalParty, setInternalParty] = useState<PartyInfo | null>(externalParty || null);
  const [isLoading, setIsLoading] = useState(false);

  // Estados para controles admin
  const [adminSkipApproval, setAdminSkipApproval] = useState(false);
  const [adminForceScheduled, setAdminForceScheduled] = useState(false);
  const [adminNotifyPlayers, setAdminNotifyPlayers] = useState(true);

  const party = externalParty || internalParty;
  const shouldLoadData = !externalParty && groupId && !internalParty;
  const effectiveGroupId = party?.groupId || groupId;

  useEffect(() => {
    if (shouldLoadData && effectiveGroupId) {
      loadPartyData(effectiveGroupId);
    }
  }, [shouldLoadData, effectiveGroupId]);

  const loadPartyData = async (gId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/parties/${gId}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        const partyInfo: PartyInfo = {
          groupId: data.party.groupId,
          groupNumber: data.party.groupNumber,
          roundNumber: data.party.roundNumber,
          players: data.party.players.map((p: any) => p.name),
          sets: data.party.sets,
          scheduleStatus: data.party.schedule.status,
          proposedDate: data.party.schedule.proposedDate,
          acceptedDate: data.party.schedule.acceptedDate,
          proposedBy: data.party.schedule.proposedBy,
          acceptedCount: data.party.schedule.acceptedCount,
          proposedByCurrentUser: data.party.schedule.proposedByCurrentUser
        };
        
        setInternalParty(partyInfo);
      } else {
        setError(data.error || "Error cargando datos del partido");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (effectiveGroupId) {
      loadPartyData(effectiveGroupId);
      onUpdate();
    }
  };

  const completedSets = party?.sets.filter(s => s.isConfirmed).length || 0;
  const playedSets = party?.sets.filter(s => s.hasResult && !s.isConfirmed).length || 0;
  const totalSets = party?.sets.length || 0;

  // Manejar propuesta de fecha (con lógica admin)
  const handleProposeDate = () => {
    if (!proposedDate || !proposedTime || !effectiveGroupId) {
      setError("Selecciona fecha y hora");
      return;
    }

    const local = new Date(`${proposedDate}T${proposedTime}`);
    if (local <= new Date()) {
      setError("La fecha debe ser futura");
      return;
    }
    const isoUTC = local.toISOString();

    setError(null);
    startTransition(async () => {
      try {
        const payload: any = {
          proposedDate: isoUTC,
          message: `Fecha propuesta para el partido del Grupo ${party?.groupNumber}`,
        };

        // Añadir opciones de admin si es necesario
        if (isAdmin && (adminSkipApproval || adminForceScheduled || !adminNotifyPlayers)) {
          payload.adminOptions = {
            skipApproval: adminSkipApproval,
            forceScheduled: adminForceScheduled,
            notifyPlayers: adminNotifyPlayers
          };
        }

        const response = await fetch(`/api/parties/${effectiveGroupId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setShowDateForm(false);
          setShowAdminControls(false);
          setProposedDate("");
          setProposedTime("");
          
          if (data.party && !externalParty) {
            const updatedPartyInfo: PartyInfo = {
              groupId: data.party.groupId,
              groupNumber: data.party.groupNumber,
              roundNumber: data.party.roundNumber,
              players: data.party.players.map((p: any) => p.name),
              sets: data.party.sets,
              scheduleStatus: data.party.schedule.status,
              proposedDate: data.party.schedule.proposedDate,
              acceptedDate: data.party.schedule.acceptedDate,
              proposedBy: data.party.schedule.proposedBy,
              acceptedCount: data.party.schedule.acceptedCount,
              proposedByCurrentUser: data.party.schedule.proposedByCurrentUser
            };
            setInternalParty(updatedPartyInfo);
          }
          
          onUpdate();
        } else {
          throw new Error(data.error || "Error al proponer fecha");
        }
      } catch (err: any) {
        setError(err.message || "Error de conexión");
      }
    });
  };

  // Cancelar fecha (solo admin)
  const handleAdminCancel = () => {
    if (!effectiveGroupId) return;
    
    startTransition(async () => {
      try {
        const response = await fetch(`/api/parties/${effectiveGroupId}`, {
          method: "DELETE",
        });

        const data = await response.json();

        if (response.ok && data.success) {
          if (data.party && !externalParty) {
            const updatedPartyInfo: PartyInfo = {
              groupId: data.party.groupId,
              groupNumber: data.party.groupNumber,
              roundNumber: data.party.roundNumber,
              players: data.party.players.map((p: any) => p.name),
              sets: data.party.sets,
              scheduleStatus: data.party.schedule.status,
              proposedDate: data.party.schedule.proposedDate,
              acceptedDate: data.party.schedule.acceptedDate,
              proposedBy: data.party.schedule.proposedBy,
              acceptedCount: data.party.schedule.acceptedCount,
              proposedByCurrentUser: data.party.schedule.proposedByCurrentUser
            };
            setInternalParty(updatedPartyInfo);
          }
          
          onUpdate();
        } else {
          throw new Error(data.error || "Error al cancelar fecha");
        }
      } catch (err: any) {
        setError(err.message || "Error de conexión");
      }
    });
  };

  // Forzar programación (solo admin)
  const handleAdminForceSchedule = () => {
    if (!proposedDate || !proposedTime || !effectiveGroupId) {
      setError("Selecciona fecha y hora para forzar programación");
      return;
    }

    const local = new Date(`${proposedDate}T${proposedTime}`);
    const isoUTC = local.toISOString();

    startTransition(async () => {
      try {
        const response = await fetch(`/api/parties/${effectiveGroupId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "admin_force_schedule",
            adminAction: true,
            forcedDate: isoUTC,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setShowDateForm(false);
          setShowAdminControls(false);
          setProposedDate("");
          setProposedTime("");
          
          if (data.party && !externalParty) {
            const updatedPartyInfo: PartyInfo = {
              groupId: data.party.groupId,
              groupNumber: data.party.groupNumber,
              roundNumber: data.party.roundNumber,
              players: data.party.players.map((p: any) => p.name),
              sets: data.party.sets,
              scheduleStatus: data.party.schedule.status,
              proposedDate: data.party.schedule.proposedDate,
              acceptedDate: data.party.schedule.acceptedDate,
              proposedBy: data.party.schedule.proposedBy,
              acceptedCount: data.party.schedule.acceptedCount,
              proposedByCurrentUser: data.party.schedule.proposedByCurrentUser
            };
            setInternalParty(updatedPartyInfo);
          }
          
          onUpdate();
        } else {
          throw new Error(data.error || "Error al forzar programación");
        }
      } catch (err: any) {
        setError(err.message || "Error de conexión");
      }
    });
  };

  const handleDateResponse = (action: "accept" | "reject") => {
    if (!effectiveGroupId) return;
    
    startTransition(async () => {
      try {
        const response = await fetch(`/api/parties/${effectiveGroupId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          if (data.party && !externalParty) {
            const updatedPartyInfo: PartyInfo = {
              groupId: data.party.groupId,
              groupNumber: data.party.groupNumber,
              roundNumber: data.party.roundNumber,
              players: data.party.players.map((p: any) => p.name),
              sets: data.party.sets,
              scheduleStatus: data.party.schedule.status,
              proposedDate: data.party.schedule.proposedDate,
              acceptedDate: data.party.schedule.acceptedDate,
              proposedBy: data.party.schedule.proposedBy,
              acceptedCount: data.party.schedule.acceptedCount,
              proposedByCurrentUser: data.party.schedule.proposedByCurrentUser
            };
            setInternalParty(updatedPartyInfo);
          }
          
          onUpdate();
        } else {
          throw new Error(data.error || `Error al ${action === "accept" ? "aceptar" : "rechazar"} la fecha`);
        }
      } catch (err: any) {
        setError(err.message || "Error de conexión");
      }
    });
  };

  const getStatusInfo = () => {
    if (!party) return { label: "Cargando...", color: "bg-gray-100 text-gray-700", icon: Clock };
    
    if (completedSets === totalSets) {
      return {
        label: "Partido completado",
        color: "bg-green-100 text-green-700",
        icon: Trophy,
      };
    }
    if (playedSets > 0) {
      return {
        label: `Sets en progreso (${completedSets + playedSets}/${totalSets})`,
        color: "bg-blue-100 text-blue-700",
        icon: Play,
      };
    }
    switch (party.scheduleStatus) {
      case "SCHEDULED":
        return {
          label: "Partido programado",
          color: "bg-green-100 text-green-700",
          icon: Calendar,
        };
      case "DATE_PROPOSED":
        return {
          label: `Fecha propuesta (${party.acceptedCount}/4)`,
          color: "bg-purple-100 text-purple-700",
          icon: Clock,
        };
      default:
        return {
          label: "Sin programar",
          color: "bg-gray-100 text-gray-700",
          icon: CalendarPlus,
        };
    }
  };

  const getNextValidDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  // Loading state
  if (isLoading || !party) {
    return (
      <Card className="w-full border-gray-200 bg-gray-50">
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Cargando información del partido...</p>
        </CardContent>
      </Card>
    );
  }

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  // Vista compacta (sin cambios)
  if (showCompactView) {
    return (
      <div className="border rounded-lg p-4 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="font-medium text-sm">Grupo {party.groupNumber}</span>
            {isAdmin && (
              <Badge variant="outline" className="text-xs">
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>
          <Badge className={statusInfo.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusInfo.label}
          </Badge>
        </div>
        
        {party.acceptedDate && (
          <div className="text-xs text-gray-600">
            {format(new Date(party.acceptedDate), "EEE d MMM HH:mm", { locale: es })}
          </div>
        )}
        
        <div className="text-xs text-gray-500">
          Sets: {completedSets}/{totalSets} confirmados
        </div>
      </div>
    );
  }

  // Vista completa
  return (
    <Card className={`w-full ${isAdmin ? 'border-blue-200 bg-blue-50' : 'border-purple-200 bg-purple-50'}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <span>Partido Completo - Grupo {party.groupNumber}</span>
            {isAdmin && (
              <Badge variant="secondary" className="ml-2">
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusInfo.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusInfo.label}
            </Badge>
            {enableRefresh && (
              <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isPending}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setError(null)}
              className="ml-auto p-1 h-auto"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">
                Ronda {party.roundNumber} • {party.players.join(" • ")}
              </div>
              {party.acceptedDate && (
                <div className="text-sm font-medium mt-1 text-green-700">
                  Programado para{" "}
                  {format(new Date(party.acceptedDate), "EEEE d 'de' MMMM HH:mm", {
                    locale: es,
                  })}
                </div>
              )}
              {!party.acceptedDate && party.proposedDate && (
                <div className="text-sm mt-1 text-purple-700">
                  Propuesto:{" "}
                  {format(new Date(party.proposedDate), "EEE d MMM HH:mm", {
                    locale: es,
                  })}{" "}
                  • Confirmaciones: {party.acceptedCount}/4
                </div>
              )}
            </div>

            <div className="text-right">
              <div className="text-xs text-gray-500">
                Sets confirmados: {completedSets}/{totalSets}
              </div>
              {playedSets > 0 && (
                <div className="text-xs text-blue-600">
                  {playedSets} sets por confirmar
                </div>
              )}
            </div>
          </div>

          {/* Controles específicos de admin */}
          {isAdmin && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900">Controles de Admin</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdminControls(!showAdminControls)}
                  className="flex items-center gap-1"
                >
                  {showAdminControls ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showAdminControls ? "Ocultar" : "Mostrar"}
                </Button>
              </div>

              {showAdminControls && (
                <div className="space-y-3">
                  <div className="text-xs text-blue-700">
                    Como admin, puedes establecer fechas sin requerir aprobación de jugadores
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {party.scheduleStatus !== "SCHEDULED" && (
                      <Button 
                        size="sm" 
                        onClick={() => setShowDateForm(true)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Establecer Fecha
                      </Button>
                    )}
                    
                    {(party.proposedDate || party.acceptedDate) && (
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={handleAdminCancel}
                        disabled={isPending}
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        Cancelar Fecha
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Controles para jugadores (lógica existente con modificaciones) */}
          {(isParticipant || isAdmin) && (
            <div className="flex flex-wrap gap-2">
              {party.scheduleStatus === "PENDING" && !isAdmin && (
                <Button size="sm" onClick={() => setShowDateForm(!showDateForm)} disabled={isPending}>
                  <CalendarPlus className="w-4 h-4 mr-2" />
                  Proponer fecha
                </Button>
              )}

              {party.scheduleStatus === "DATE_PROPOSED" && !party.proposedByCurrentUser && !isAdmin && (
                <>
                  <Button size="sm" onClick={() => handleDateResponse("accept")} disabled={isPending}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aceptar fecha
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDateResponse("reject")}
                    disabled={isPending}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Rechazar
                  </Button>
                </>
              )}

              {party.scheduleStatus === "DATE_PROPOSED" && party.proposedByCurrentUser && !isAdmin && (
                <div className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                  Esperando confirmación de otros jugadores ({party.acceptedCount}/4)
                </div>
              )}
            </div>
          )}

          {/* Formulario de fecha (extendido para admin) */}
          {((isParticipant && showDateForm) || (isAdmin && showDateForm)) && party.scheduleStatus !== "SCHEDULED" && (
            <div className={`border rounded-lg p-3 space-y-3 ${isAdmin ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha</label>
                  <Input
                    type="date"
                    value={proposedDate}
                    onChange={(e) => setProposedDate(e.target.value)}
                    min={getNextValidDate()}
                    disabled={isPending}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Hora</label>
                  <Input
                    type="time"
                    value={proposedTime}
                    onChange={(e) => setProposedTime(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>

              {/* Opciones específicas de admin */}
              {isAdmin && (
                <div className="space-y-3 bg-blue-100 p-3 rounded border border-blue-300">
                  <div className="text-sm font-medium text-blue-900">Opciones de Admin</div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="skip-approval"
                      checked={adminSkipApproval}
                      onCheckedChange={setAdminSkipApproval}
                    />
                    <Label htmlFor="skip-approval" className="text-sm">
                      Proponer sin requerir aprobación
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="force-scheduled"
                      checked={adminForceScheduled}
                      onCheckedChange={setAdminForceScheduled}
                    />
                    <Label htmlFor="force-scheduled" className="text-sm">
                      Marcar como confirmado automáticamente
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="notify-players"
                      checked={adminNotifyPlayers}
                      onCheckedChange={setAdminNotifyPlayers}
                    />
                    <Label htmlFor="notify-players" className="text-sm">
                      Notificar a jugadores
                    </Label>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                {isAdmin && adminForceScheduled 
                  ? "Se programarán los 3 sets para la fecha seleccionada sin requerir confirmación de jugadores."
                  : "Se programarán los 3 sets para la misma fecha. Todos los jugadores deben confirmar."
                }
              </div>

              <div className="flex gap-2">
                {isAdmin ? (
                  <>
                    <Button onClick={handleProposeDate} disabled={isPending} size="sm">
                      {isPending ? "Aplicando..." : adminForceScheduled ? "Programar Directamente" : "Proponer Fecha"}
                    </Button>
                    {adminForceScheduled && (
                      <Button 
                        onClick={handleAdminForceSchedule} 
                        disabled={isPending} 
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        {isPending ? "Forzando..." : "Forzar Programación"}
                      </Button>
                    )}
                  </>
                ) : (
                  <Button onClick={handleProposeDate} disabled={isPending} size="sm">
                    {isPending ? "Enviando..." : "Proponer fecha"}
                  </Button>
                )}
                
                <Button
                  onClick={() => {
                    setShowDateForm(false);
                    setShowAdminControls(false);
                    setProposedDate("");
                    setProposedTime("");
                    setError(null);
                  }}
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>

        {!isParticipant && !isAdmin && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                Solo los jugadores de este grupo pueden gestionar la fecha del partido
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}