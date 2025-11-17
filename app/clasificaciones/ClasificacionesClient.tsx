// app/clasificaciones/ClasificacionesClient.tsx - REFACTORIZADO CON COMPONENTE UNIFICADO
"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import TournamentSelector from "@/components/TournamentSelector";
import UnifiedRankingsTable from "@/components/rankings/UnifiedRankingsTable";
import { useRankingsData } from "@/lib/hooks/useRankingsData";
import { useState } from "react";

type ClasificacionesClientProps = {
  initialTournamentId?: string;
};

export default function ClasificacionesClient({ initialTournamentId }: ClasificacionesClientProps) {
  const { data: session } = useSession();
  const [selectedTournamentId, setSelectedTournamentId] = useState(initialTournamentId);

  const {
    data: rankingsData,
    loading,
    error,
    refresh,
  } = useRankingsData({
    tournamentId: selectedTournamentId,
    autoFetch: true,
  });

  const currentUserId = session?.user?.id;
  const playerId = (session?.user as any)?.playerId;

  if (loading) {
    return (
      <div className="px-4 py-6 max-w-7xl mx-auto">
        <Breadcrumbs />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-gray-600">Cargando rankings...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 max-w-7xl mx-auto">
        <Breadcrumbs />
        <Card className="mt-6 border-red-200 bg-red-50">
          <CardContent className="py-12 text-center">
            <p className="text-red-600 font-medium mb-4">Error al cargar rankings</p>
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <Button onClick={refresh} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Intentar de nuevo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!rankingsData) {
    return (
      <div className="px-4 py-6 max-w-7xl mx-auto">
        <Breadcrumbs />
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No hay datos de ranking disponibles</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-6">
      <Breadcrumbs />

      {/* Header con selector de torneo */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rankings</h1>
          <p className="text-gray-600 mt-1">{rankingsData.tournamentTitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <TournamentSelector
            value={selectedTournamentId || ""}
            onChange={setSelectedTournamentId}
          />
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabla unificada de rankings */}
      <UnifiedRankingsTable
        officialRankings={rankingsData.official}
        ironmanRankings={rankingsData.ironman}
        tournamentTitle={rankingsData.tournamentTitle}
        roundNumber={rankingsData.roundNumber}
        compact={false}
        isAdmin={false}
        highlightPlayerId={playerId}
      />
    </div>
  );
}
