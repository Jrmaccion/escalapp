// app/dashboard/PlayerDashboardClient.tsx - VERSIÓN MÁS FOCUSADA
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Play,
  ArrowRight,
  Crown,
  Target
} from "lucide-react";
import Link from "next/link";

// Tipos simplificados - Solo lo crítico
type DashboardData = {
  activeTournament: {
    id: string;
    title: string;
    currentRound: number;
    totalRounds: number;
    roundEndDate: string;
  } | null;
  myStatus: {
    groupNumber: number;
    position: number;
    points: number;
    streak: number;
  } | null;
  nextAction: {
    type: 'PLAY_MATCH' | 'CONFIRM_RESULT' | 'WAIT';
    title: string;
    description: string;
    actionUrl?: string;
    priority: 'high' | 'medium' | 'low';
  } | null;
  quickStats: {
    officialRank: number;
    ironmanRank: number;
    matchesPending: number;
  };
};

const PREVIEW_DATA: DashboardData = {
  activeTournament: {
    id: "preview",
    title: "Torneo Escalera Primavera 2025",
    currentRound: 2,
    totalRounds: 8,
    roundEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  myStatus: {
    groupNumber: 2,
    position: 1,
    points: 8.5,
    streak: 2
  },
  nextAction: {
    type: 'PLAY_MATCH',
    title: 'Tienes un set pendiente',
    description: 'Set 3 vs Miguel López + Laura Rodríguez',
    actionUrl: '/mi-grupo',
    priority: 'high'
  },
  quickStats: {
    officialRank: 2,
    ironmanRank: 2,
    matchesPending: 1
  }
};

export default function PlayerDashboardClient() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/player/dashboard');
      if (response.ok) {
        const dashboardData = await response.json();
        if (!dashboardData.activeTournament) {
          setData(PREVIEW_DATA);
          setIsPreviewMode(true);
        } else {
          const simplified: DashboardData = {
            activeTournament: dashboardData.activeTournament,
            myStatus: dashboardData.currentGroup ? {
              groupNumber: dashboardData.currentGroup.number,
              position: dashboardData.currentGroup.position,
              points: dashboardData.currentGroup.points,
              streak: dashboardData.currentGroup.streak || 0
            } : null,
            nextAction: determineNextAction(dashboardData),
            quickStats: {
              officialRank: dashboardData.ranking?.position || 0,
              ironmanRank: dashboardData.ranking?.ironmanPosition || 0,
              matchesPending: dashboardData.stats?.matchesPending || 0
            }
          };
          setData(simplified);
          setIsPreviewMode(false);
        }
      } else {
        setError('Error al cargar datos');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // Lógica MUCHO más simple para determinar próxima acción
  const determineNextAction = (rawData: any) => {
    const pending = rawData.stats?.matchesPending || 0;
    
    if (pending > 0) {
      return {
        type: 'PLAY_MATCH' as const,
        title: 'Tienes sets pendientes',
        description: `${pending} set${pending > 1 ? 's' : ''} por completar`,
        actionUrl: '/mi-grupo',
        priority: 'high' as const
      };
    }
    
    return {
      type: 'WAIT' as const,
      title: 'Todo al día',
      description: 'No tienes acciones pendientes',
      priority: 'low' as const
    };
  };

  useEffect(() => {
    if (session?.user) {
      fetchDashboardData();
    }
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center py-20">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchDashboardData}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const daysUntilRoundEnd = Math.ceil(
    (new Date(data.activeTournament!.roundEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className={`min-h-screen bg-gray-50 py-8 ${isPreviewMode ? 'opacity-75' : ''}`}>
      <div className="container mx-auto px-4 max-w-4xl space-y-6">
        
        {/* SIMPLIFICADO: Solo nombre y torneo */}
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Hola, {session?.user?.name?.split(' ')[0] ?? 'Jugador'}
          </h1>
          <p className="text-gray-600">
            {data.activeTournament!.title} - Ronda {data.activeTournament!.currentRound}
          </p>
          {isPreviewMode && (
            <Badge variant="secondary" className="mt-2">
              Vista Previa
            </Badge>
          )}
        </div>

        {/* PRIORIDAD 1: Solo próxima acción (sin distracciones) */}
        {data.nextAction && (
          <Card className={`border-2 ${
            data.nextAction.priority === 'high' ? 'border-red-200 bg-red-50' :
            data.nextAction.priority === 'medium' ? 'border-yellow-200 bg-yellow-50' :
            'border-green-200 bg-green-50'
          }`}>
            <CardContent className="p-8 text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                data.nextAction.priority === 'high' ? 'bg-red-100 text-red-600' :
                data.nextAction.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                'bg-green-100 text-green-600'
              }`}>
                {data.nextAction.type === 'PLAY_MATCH' && <Play className="w-8 h-8" />}
                {data.nextAction.type === 'CONFIRM_RESULT' && <Clock className="w-8 h-8" />}
                {data.nextAction.type === 'WAIT' && <CheckCircle className="w-8 h-8" />}
              </div>
              
              <h2 className="text-xl font-bold mb-2">{data.nextAction.title}</h2>
              <p className="text-gray-600 mb-6">{data.nextAction.description}</p>
              
              {data.nextAction.actionUrl && !isPreviewMode && (
                <Link href={data.nextAction.actionUrl}>
                  <Button size="lg" className="px-8">
                    {data.nextAction.type === 'PLAY_MATCH' ? 'Ir a Mi Grupo' : 'Ir'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              )}
              
              {data.nextAction.actionUrl && isPreviewMode && (
                <Button size="lg" className="px-8" disabled>
                  Ir a Mi Grupo
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* SIMPLIFICADO: Solo 2 stats principales */}
        {data.myStatus && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <Target className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-blue-600">#{data.myStatus.position}</div>
                <div className="text-sm text-gray-600">Mi Posición</div>
                <div className="text-xs text-gray-500 mt-1">Grupo {data.myStatus.groupNumber}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <Trophy className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-purple-600">#{data.quickStats.officialRank}</div>
                <div className="text-sm text-gray-600">Ranking Oficial</div>
                <div className="text-xs text-gray-500 mt-1">{data.myStatus.points} puntos</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Acceso directo a secciones principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/mi-grupo">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-6 flex items-center justify-between h-full">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">Mi Grupo</h3>
                    <p className="text-sm text-gray-600">
                      Ver sets y posiciones
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/clasificaciones">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-6 flex items-center justify-between h-full">
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-yellow-600" />
                  <div>
                    <h3 className="font-semibold">Rankings</h3>
                    <p className="text-sm text-gray-600">
                      Ver clasificaciones
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Solo avisos críticos de tiempo */}
        {daysUntilRoundEnd <= 1 && daysUntilRoundEnd > 0 && !isPreviewMode && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 text-orange-600 mx-auto mb-2" />
              <p className="font-medium text-orange-800">
                ¡Último día de la ronda!
              </p>
            </CardContent>
          </Card>
        )}

        {/* CTA para preview */}
        {isPreviewMode && (
          <Card className="border-dashed border-2 border-blue-300 bg-blue-50">
            <CardContent className="p-8 text-center">
              <Crown className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-blue-900 mb-2">
                ¡Únete a un Torneo Real!
              </h3>
              <p className="text-blue-700 mb-6">
                Estos son datos de ejemplo. Contacta con el administrador para participar.
              </p>
              <Button variant="default">
                Contactar Administrador
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}