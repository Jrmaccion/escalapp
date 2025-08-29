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
  MessageSquare,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Match = {
  id: string;
  setNumber: number;
  status: 'PENDING' | 'DATE_PROPOSED' | 'SCHEDULED' | 'COMPLETED';
  proposedDate: string | null;
  acceptedDate: string | null;
  proposedBy: string | null;
  acceptedCount: number;
  team1Player1Name: string;
  team1Player2Name: string;
  team2Player1Name: string;
  team2Player2Name: string;
  team1Games: number | null;
  team2Games: number | null;
  isConfirmed: boolean;
};

type MatchSchedulingProps = {
  match: Match;
  currentUserId: string;
  isParticipant: boolean;
  onUpdate: () => void;
};

export default function MatchScheduling({ match, currentUserId, isParticipant, onUpdate }: MatchSchedulingProps) {
  const [isPending, startTransition] = useTransition();
  const [showDateForm, setShowDateForm] = useState(false);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('');

  const getStatusBadge = () => {
    switch (match.status) {
      case 'PENDING':
        return <Badge variant="outline">Sin fecha</Badge>;
      case 'DATE_PROPOSED':
        return <Badge variant="secondary">Fecha propuesta ({match.acceptedCount}/4)</Badge>;
      case 'SCHEDULED':
        return <Badge variant="default">Programado</Badge>;
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-600">Completado</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const handleProposeDate = () => {
    if (!proposedDate || !proposedTime) {
      alert('Por favor selecciona fecha y hora');
      return;
    }

    const datetime = `${proposedDate}T${proposedTime}`;
    
    startTransition(async () => {
      try {
        const response = await fetch(`/api/matches/${match.id}/propose-date`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposedDate: datetime })
        });

        const data = await response.json();
        
        if (response.ok) {
          alert(data.message);
          setShowDateForm(false);
          setProposedDate('');
          setProposedTime('');
          onUpdate();
        } else {
          alert(data.error || 'Error al proponer fecha');
        }
      } catch (error) {
        alert('Error de conexión');
      }
    });
  };

  const handleDateResponse = (action: 'accept' | 'reject') => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/matches/${match.id}/propose-date`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });

        const data = await response.json();
        
        if (response.ok) {
          alert(data.message);
          onUpdate();
        } else {
          alert(data.error || 'Error al responder');
        }
      } catch (error) {
        alert('Error de conexión');
      }
    });
  };

  const getNextValidDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Set {match.setNumber} - Programación
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Información del partido */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm">
            <div className="font-medium text-blue-700">
              {match.team1Player1Name} + {match.team1Player2Name}
            </div>
            <div className="text-gray-500 text-center my-1">vs</div>
            <div className="font-medium text-red-700">
              {match.team2Player1Name} + {match.team2Player2Name}
            </div>
          </div>
        </div>

        {/* Estado actual y acciones */}
        {match.status === 'PENDING' && isParticipant && (
          <div className="space-y-3">
            {!showDateForm ? (
              <Button 
                onClick={() => setShowDateForm(true)}
                className="w-full"
                disabled={isPending}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Proponer fecha y hora
              </Button>
            ) : (
              <div className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">Proponer nueva fecha</span>
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
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleProposeDate}
                    disabled={isPending}
                    size="sm"
                  >
                    Proponer
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowDateForm(false);
                      setProposedDate('');
                      setProposedTime('');
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

        {match.status === 'DATE_PROPOSED' && match.proposedDate && (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">Fecha propuesta</span>
              </div>
              <div className="text-blue-800">
                {format(new Date(match.proposedDate), "EEEE, d 'de' MMMM 'a las' HH:mm", { locale: es })}
              </div>
              {match.proposedBy && (
                <div className="text-xs text-blue-600 mt-1">
                  Propuesto por {match.proposedBy}
                </div>
              )}
              <div className="text-xs text-blue-600 mt-1">
                Confirmado por {match.acceptedCount} de 4 jugadores
              </div>
            </div>

            {isParticipant && (
              <div className="flex gap-2">
                <Button
                  onClick={() => handleDateResponse('accept')}
                  disabled={isPending}
                  size="sm"
                  className="flex-1"
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
          </div>
        )}

        {match.status === 'SCHEDULED' && match.acceptedDate && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="font-medium text-green-900">Partido programado</span>
            </div>
            <div className="text-green-800 font-medium">
              {format(new Date(match.acceptedDate), "EEEE, d 'de' MMMM 'a las' HH:mm", { locale: es })}
            </div>
            <div className="text-xs text-green-600 mt-1">
              Confirmado por todos los jugadores
            </div>
          </div>
        )}

        {match.status === 'COMPLETED' && match.isConfirmed && (
          <div className="bg-gray-50 border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="font-medium">Partido completado</span>
              </div>
              <div className="font-mono font-bold">
                {match.team1Games !== null && match.team2Games !== null
                  ? `${match.team1Games}-${match.team2Games}`
                  : '-'
                }
              </div>
            </div>
          </div>
        )}

        {!isParticipant && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                Solo los jugadores de este partido pueden gestionar fechas
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}