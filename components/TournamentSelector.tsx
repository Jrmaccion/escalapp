"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  Trophy, 
  Calendar, 
  Users,
  CheckCircle,
  Clock
} from "lucide-react";

type Tournament = {
  id: string;
  title: string;
  isActive: boolean;
  isCurrent: boolean;
};

type TournamentSelectorProps = {
  tournaments: Tournament[];
  currentTournament: Tournament | null;
  onTournamentChange: (tournamentId: string) => void;
  isLoading?: boolean;
  className?: string;
};

export default function TournamentSelector({
  tournaments,
  currentTournament,
  onTournamentChange,
  isLoading = false,
  className = ""
}: TournamentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!tournaments || tournaments.length <= 1) {
    // No mostrar selector si solo hay un torneo o ninguno
    return null;
  }

  const activeTournaments = tournaments.filter(t => t.isActive);
  const inactiveTournaments = tournaments.filter(t => !t.isActive);

  const handleTournamentSelect = (tournamentId: string) => {
    setIsOpen(false);
    onTournamentChange(tournamentId);
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
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              <span>Selector de Torneo</span>
            </div>
            <Badge variant="outline">
              {tournaments.length} disponibles
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Estás participando en múltiples torneos. Selecciona cuál quieres ver:
            </p>
            
            {/* Botón principal del selector */}
            <Button
              variant="outline"
              className="w-full justify-between text-left"
              onClick={() => setIsOpen(!isOpen)}
              disabled={isLoading}
            >
              <div className="flex items-center gap-3">
                <Trophy className="w-4 h-4" />
                <div>
                  <div className="font-medium">
                    {currentTournament?.title || "Seleccionar torneo"}
                  </div>
                  {currentTournament && (
                    <div className="text-xs text-gray-500">
                      {currentTournament.isActive ? "Torneo activo" : "Torneo finalizado"}
                    </div>
                  )}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </Button>

            {/* Lista desplegable */}
            {isOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1">
                <Card className="border shadow-lg">
                  <CardContent className="p-2">
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
                                tournament.isCurrent ? "bg-blue-50 border border-blue-200" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Trophy className="w-4 h-4" />
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
                            tournament.isCurrent ? "bg-blue-50 border border-blue-200" : ""
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
        </CardContent>
      </Card>
    </div>
  );
}