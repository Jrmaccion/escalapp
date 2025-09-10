"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  Users, 
  Info,
  AlertTriangle
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
  showInfoOnly?: boolean; // Nueva prop para controlar si solo mostrar info
};

export default function MatchScheduling({ 
  match, 
  currentUserId, 
  isParticipant, 
  onUpdate,
  showInfoOnly = true // Por defecto solo mostrar información
}: MatchSchedulingProps) {

  const getStatusBadge = () => {
    switch (match.status) {
      case 'PENDING':
        return <Badge variant="outline">Sin fecha programada</Badge>;
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

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Set {match.setNumber} - Estado de Programación
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Información del set */}
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

        {/* Estado actual de programación */}
        {match.status === 'PENDING' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-900">Sin fecha programada</span>
            </div>
            <div className="text-blue-700 text-sm">
              Este set aún no tiene fecha programada. Las fechas se coordinan a nivel de partido completo.
            </div>
          </div>
        )}

        {match.status === 'DATE_PROPOSED' && match.proposedDate && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-purple-900">Fecha propuesta</span>
            </div>
            <div className="text-purple-800">
              {format(new Date(match.proposedDate), "EEEE, d 'de' MMMM 'a las' HH:mm", { locale: es })}
            </div>
            {match.proposedBy && (
              <div className="text-xs text-purple-600 mt-1">
                Propuesto por {match.proposedBy}
              </div>
            )}
            <div className="text-xs text-purple-600 mt-1">
              Confirmado por {match.acceptedCount} de 4 jugadores
            </div>
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
                <span className="font-medium">Set completado</span>
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

        {/* Información sobre el sistema unificado */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-1">Sistema de Programación Unificado</p>
              <p className="text-blue-700">
                Las fechas se coordinan para los 3 sets del partido juntos. 
                Usa el sistema de programación de partido en la vista del grupo para coordinar fechas.
              </p>
            </div>
          </div>
        </div>

        {/* Solo mostrar warning si no es participante */}
        {!isParticipant && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                Solo los jugadores de este set pueden gestionar fechas
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}