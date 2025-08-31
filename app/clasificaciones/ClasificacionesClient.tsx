"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, TrendingUp, AlertTriangle } from "lucide-react";

type RankingRow = {
  id: string;
  name: string;
  position: number;
  totalPoints: number;
  roundsPlayed: number;
  averagePoints: number;
};

type ApiPayload = {
  hasActiveTournament: boolean;
  hasRankings: boolean;
  message?: string;
  tournament?: { id: string; title: string };
  official: RankingRow[];
  ironman: RankingRow[];
};

export default function ClasificacionesClient() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/rankings", { cache: "no-store" });
        const json = (await res.json()) as ApiPayload;
        setData(json);
      } catch {
        setData({
          hasActiveTournament: false,
          hasRankings: false,
          official: [],
          ironman: [],
          message: "Error de conexión",
        } as ApiPayload);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data?.hasActiveTournament || !data?.hasRankings) {
    return (
      <Card className="bg-gray-50">
        <CardContent className="py-16 text-center">
          <div className="flex items-center justify-center text-gray-500 mb-4">
            <AlertTriangle className="h-8 w-8 mr-2" />
            <span className="text-xl font-semibold">Sin rankings disponibles</span>
          </div>
          <p className="text-gray-600">{data?.message ?? "No hay datos para mostrar."}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="official" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="official">Ranking Oficial</TabsTrigger>
        <TabsTrigger value="ironman">Ranking Ironman</TabsTrigger>
      </TabsList>

      <TabsContent value="official">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" /> Clasificación General
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {data.official.map((p) => (
                <li key={p.id} className="flex items-center justify-between p-3 rounded border bg-white">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">#{p.position}</Badge>
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-6 text-sm text-gray-600">
                    <div><span className="font-semibold">{p.totalPoints.toFixed(1)}</span> pts</div>
                    <div><span className="font-semibold">{p.roundsPlayed}</span> rondas</div>
                    <div>Promedio <span className="font-semibold">{p.averagePoints.toFixed(2)}</span></div>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ironman">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Ranking Ironman
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {data.ironman.map((p) => (
                <li key={p.id} className="flex items-center justify-between p-3 rounded border bg-white">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">#{p.position}</Badge>
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-6 text-sm text-gray-600">
                    <div><span className="font-semibold">{p.totalPoints.toFixed(1)}</span> pts</div>
                    <div>Promedio <span className="font-semibold">{p.averagePoints.toFixed(2)}</span></div>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
