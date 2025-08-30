"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";

type GroupData = {
  hasGroup: boolean;
  message?: string;
  group?: {
    number: number;
    level: string;
  };
  myStatus?: {
    position: number;
    points: number;
  };
  players?: Array<{
    id: string;
    name: string;
    points: number;
    position: number;
    isCurrentUser: boolean;
  }>;
};

export default function MiGrupoClient() {
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/player/group');
        if (response.ok) {
          const groupData = await response.json();
          setData(groupData);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  if (!data?.hasGroup) {
    return (
      <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        <Breadcrumbs />
        <div className="text-center py-20">
          <AlertTriangle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sin Grupo Asignado</h2>
          <p className="text-gray-600">{data?.message || "No estás asignado a ningún grupo."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">
      <Breadcrumbs />
      <h1 className="text-2xl font-bold">Mi Grupo</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">Grupo {data.group?.number}</div>
              <div className="text-sm text-gray-600">{data.group?.level}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data.myStatus?.position}°</div>
              <div className="text-sm text-gray-600">Mi posición</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {data.players?.map((player) => (
              <div key={player.id} className={`flex justify-between p-3 rounded ${
                player.isCurrentUser ? 'bg-blue-50' : 'bg-gray-50'
              }`}>
                <span>{player.name} {player.isCurrentUser && "(Tú)"}</span>
                <span>{player.points} pts</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}