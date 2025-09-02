"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  X, 
  Users, 
  AlertTriangle,
  CalendarPlus
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type PartyInfo = {
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
  // Programación a nivel de partido
  scheduleStatus: 'PENDING' | 'DATE_PROPOSED' | 'SCHEDULED' | 'COMPLETED';
  proposedDate: string | null;
  acceptedDate: string | null;
  proposedBy: string | null;
  acceptedCount: number;
  proposedByCurrentUser?: boolean;
};

type PartySchedulingProps = {
  party: PartyInfo;
  currentUserId: string;
  isParticipant: boolean;
  onUpdate: () => void;
};

export default function PartyScheduling({ 
  party, 
  currentUserId, 
  isParticipant, 
  onUpdate 
}: PartySchedulingProps) {
  const [isPending, startTransition] = useTransition();
  const [showDateForm, setShowDateForm] = useState(false);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  const completedSets = party.sets.filter(s => s.isConfirmed).length;
  const playedSets = party.sets.filter(s => s.hasResult).length;
  const totalSets = party.sets.length;

  const getStatusInfo = () => {
    if (completedSets === totalSets) {
      return {
        label: "Partido completado",
        color: "bg-green-100 text-green-700",
        icon: CheckCircle
      };
    }
    
    if (playedSets > 0) {
      return {
        label: `Sets jugados (${playedSets}/${totalSets})`,
        color: "bg-blue-100 text-blue-700", 
        icon: Clock
      };
    }

    switch (party.scheduleStatus) {
      case 'SCHEDULED':
        return {
          label: "Partido programado",
          color: "bg-green-100 text-green-700",
          icon: Calendar
        };
      case 'DATE_PROPOSED':
        return {
          label: `Fecha propuesta (${party.acceptedCount}/4)`,
          color: "bg-purple-100 text-purple-700",
          icon: Clock
        };
      default:
        return {
          label: "Sin programar",
          color: "bg-gray-100 text-gray-700",
          icon: CalendarPlus
        };
    }
  };

  const handleProposeDate = () => {
    if (!proposedDate || !proposedTime) {
      setError('Selecciona fecha y hora');
      return;
    }

    const datetime = `${proposedDate}T${proposedTime}`;
    
    if (new Date(datetime) <= new Date()) {
      setError('La fecha debe ser futura');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/matches/party/propose-date`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            groupId: party.groupId,
            proposedDate: datetime,
            message: `Fecha propuesta para el partido del Grupo ${party.groupNumber}`
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          setShowDateForm(false);
          setProposedDate('');
          setProposedTime('');
          onUpdate();
        } else {
          throw new Error(data.error || 'Error al proponer fecha');
        }
      } catch (err: any) {
        setError(err.message || 'Error de conexión');
      }
    });
  };

  const handleDateResponse = (action: 'accept' | 'reject') => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/matches/party/respond-date`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            groupId: party.groupId,
            action 
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          onUpdate();
        } else {
          throw new Error(data.error || `Error al ${action === 'accept' ? 'aceptar' : 'rechazar'} la fecha`);
        }
      } catch (err: any) {
        setError(err.message || 'Error de conexión');
      }
    });
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  const getNextValidDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <Card className="w-full border-purple-200 bg-purple-50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            <span>Partido Completo - Grupo {party.groupNumber}</span>
          </div>
          <Badge className={statusInfo.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusInfo.label}
          </Badge>
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

        {/* Información de los 3 sets */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-600" />
            <span className="font-medium">Sets del partido ({completedSets}/{totalSets} completados)</span>
          </div>
          
          <div className="space-y-2 text-sm">
            {party.sets.map((set) => (
              <div key={set.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <strong>Set {set.setNumber}:</strong> {set.team1Player1Name} + {set.team1Player2Name} vs {set.team2Player1Name} + {set.team2Player2Name}
                </div>
                <div className="flex items-center gap-2">
                  {set.isConfirmed && <CheckCircle className="w-4 h-4 text-green-600" />}
                  {set.hasResult && !set.isConfirmed && <Clock className="w-4 h-4 text-yellow-600" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Programación del partido */}
        {party.scheduleStatus === 'SCHEDULED' && party.acceptedDate && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="font-medium text-green-900">Partido programado</span>
            </div>
            <div className="text-green-800 font-medium">
              {format(new Date(party.acceptedDate), "EEEE, d 'de' MMMM 'a las' HH:mm", { locale: es })}
            </div>
            <div className="text-xs text-green-600 mt-2">
              Todos los jugadores han confirmado la fecha. Se jugarán los 3 sets este día.
            </div>
          </div>
        )}

        {party.scheduleStatus === 'DATE_PROPOSED' && party.proposedDate && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-purple-900">Fecha propuesta para el partido</span>
            </div>
            <div className="text-purple-800">
              {format(new Date(party.proposedDate), "EEEE, d 'de' MMMM 'a las' HH:mm", { locale: es })}
            </div>
            <div className="text-xs text-purple-600">
              Confirmado por {party.acceptedCount} de 4 jugadores
            </div>

            {isParticipant && !party.proposedByCurrentUser && (
              <div className="flex gap-2">
                <Button
                  onClick={() => handleDateResponse('accept')}
                  disabled={isPending}
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Aceptar fecha
                </Button>
                <Button
                  onClick={() => handleDateResponse('reject')}
                  disabled={isPending}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Rechazar
                </Button>
              </div>
            )}

            {party.proposedByCurrentUser && (
              <div className="text-sm text-purple-600 bg-purple-100 p-2 rounded">
                Esperando confirmación de otros jugadores...
              </div>
            )}
          </div>
        )}

        {party.scheduleStatus === 'PENDING' && isParticipant && completedSets === 0 && (
          <div className="space-y-3">
            {!showDateForm ? (
              <Button 
                onClick={() => setShowDateForm(true)}
                className="w-full"
                disabled={isPending}
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                Proponer fecha para el partido
              </Button>
            ) : (
              <div className="space-y-3 border rounded-lg p-4 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">Proponer fecha para los 3 sets</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Fecha</label>
                    <Input
                      type="date"
                      value={proposedDate}
                      onChange={(e) => setProposedDate(e.target.value)}
                      min={getNextValidDate()}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Hora</label>
                    <Input
                      type="time"
                      value={proposedTime}
                      onChange={(e) => setProposedTime(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  Se programarán los 3 sets para la misma fecha. Todos los jugadores deben confirmar.
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleProposeDate}
                    disabled={isPending}
                    size="sm"
                  >
                    {isPending ? 'Enviando...' : 'Proponer fecha'}
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowDateForm(false);
                      setProposedDate('');
                      setProposedTime('');
                      setError(null);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {!isParticipant && (
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