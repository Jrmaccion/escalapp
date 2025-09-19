// components/TournamentSelector.tsx - COMPLETO Y CORREGIDO
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  Trophy, 
  Calendar, 
  Users,
  CheckCircle,
  Clock,
  RefreshCw
} from "lucide-react";

type Tournament = {
  id: string;
  title: string;
  isActive: boolean;
  isCurrent: boolean;
};

// ✅ EXPORTADO: Props actualizadas para coincidir con el uso
export type TournamentSelectorProps = {
  value: string; // ✅ valor seleccionado actual
  onChange: (tournamentId: string) => void; // ✅ callback simple
  onlyActive?: boolean; // ✅ filtrar solo activos
  className?: string;
  isLoading?: boolean;
};

export default function TournamentSelector({
  value,
  onChange,
  onlyActive = false,
  className = "",
  isLoading = false
}: TournamentSelectorProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // ✅ Fetch tournaments
  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/tournaments', {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error('Error al cargar torneos');
        }

        const data = await response.json();
        if (data.success) {
          let filteredTournaments = data.tournaments || [];
          
          if (onlyActive) {
            filteredTournaments = filteredTournaments.filter((t: Tournament) => t.isActive);
          }
          
          setTournaments(filteredTournaments);
          
          // Si no hay valor seleccionado y hay torneos, seleccionar el primero activo
          if (!value && filteredTournaments.length > 0) {
            const currentTournament = filteredTournaments.find((t: Tournament) => t.isCurrent) 
              || filteredTournaments[0];
            onChange(currentTournament.id);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, [onlyActive, onChange, value]);

  const currentTournament = tournaments.find(t => t.id === value);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
        <span className="text-sm text-gray-600">Cargando torneos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={`border-red-200 bg-red-50 ${className}`}>
        <CardContent className="p-4">
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!tournaments || tournaments.length === 0) {
    return (
      <Card className={`border-gray-200 bg-gray-50 ${className}`}>
        <CardContent className="p-4">
          <p className="text-sm text-gray-600">No hay torneos disponibles</p>
        </CardContent>
      </Card>
    );
  }

  if (tournaments.length === 1) {
    // Solo mostrar información si hay un solo torneo
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Trophy className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium">{tournaments[0].title}</span>
        {tournaments[0].isActive ? (
          <Badge className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Activo
          </Badge>
        ) : (
          <Badge variant="secondary">Finalizado</Badge>
        )}
      </div>
    );
  }

  const activeTournaments = tournaments.filter(t => t.isActive);
  const inactiveTournaments = tournaments.filter(t => !t.isActive);

  const handleTournamentSelect = (tournamentId: string) => {
    setIsOpen(false);
    onChange(tournamentId);
  };

  const getTournamentBadge = (tournament: Tournament) => {
    if (tournament.isCurrent) {
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-300">
          <CheckCircle className="w-3 h-3 mr-1" />
          Actual
        </Badge>
      );
    }
    if (tournament.isActive) {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-300">
          <Clock className="w-3 h-3 mr-1" />
          Activo
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        Finalizado
      </Badge>
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* Selector compacto */}
      <Button
        variant="outline"
        className="w-full justify-between text-left min-w-[250px]"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          <div className="text-left">
            <div className="font-medium text-sm">
              {currentTournament?.title || "Seleccionar torneo"}
            </div>
            {currentTournament && (
              <div className="text-xs text-gray-500">
                {currentTournament.isActive ? "Torneo activo" : "Torneo finalizado"}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentTournament && getTournamentBadge(currentTournament)}
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </Button>

      {/* Lista desplegable */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1">
          <Card className="border shadow-lg bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Seleccionar Torneo</span>
                <Badge variant="outline" className="text-xs">
                  {tournaments.length} disponibles
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 max-h-80 overflow-y-auto">
              <div className="space-y-1">
                {/* Torneos activos primero */}
                {activeTournaments.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b">
                      Torneos Activos
                    </div>
                    {activeTournaments.map((tournament) => (
                      <button
                        key={tournament.id}
                        onClick={() => handleTournamentSelect(tournament.id)}
                        className={`w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors ${
                          tournament.id === value ? "bg-blue-50 border border-blue-200" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Trophy className="w-4 h-4 text-blue-600" />
                            <div>
                              <div className="font-medium text-sm">
                                {tournament.title}
                              </div>
                              <div className="text-xs text-gray-500">
                                Torneo en curso
                              </div>
                            </div>
                          </div>
                          {getTournamentBadge(tournament)}
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {/* Separador si hay ambos tipos */}
                {activeTournaments.length > 0 && inactiveTournaments.length > 0 && (
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b">
                    Torneos Finalizados
                  </div>
                )}

                {/* Torneos finalizados */}
                {inactiveTournaments.map((tournament) => (
                  <button
                    key={tournament.id}
                    onClick={() => handleTournamentSelect(tournament.id)}
                    className={`w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors opacity-75 ${
                      tournament.id === value ? "bg-blue-50 border border-blue-200" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-sm text-gray-700">
                            {tournament.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            Torneo finalizado
                          </div>
                        </div>
                      </div>
                      {getTournamentBadge(tournament)}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}