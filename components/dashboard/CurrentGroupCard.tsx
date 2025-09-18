// components/dashboard/CurrentGroupCard.tsx - CON PREVIEW DE PUNTOS
"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Trophy, ArrowRight, Crown, Flame, TrendingUp, TrendingDown, Minus, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import PointsPreviewCard from "@/components/PointsPreviewCard";

type GroupMember = {
  playerId: string;
  name: string;
  position: number;
  points: number;
  streak: number;
  isCurrentUser: boolean;
};

type CurrentGroupData = {
  id: string;
  number: number;
  level?: string | null;
  roundNumber: number;
  members: GroupMember[];
};

type Props = {
  groupData: CurrentGroupData;
  currentUserId?: string;
};

export function CurrentGroupCard({ groupData, currentUserId }: Props) {
  const { id: groupId, number, level, roundNumber, members } = groupData;
  const [showPreview, setShowPreview] = useState(true);
  
  // Ordenar miembros por posición
  const sortedMembers = [...members].sort((a, b) => a.position - b.position);
  
  // Encontrar al usuario actual
  const currentUser = members.find(m => m.isCurrentUser);
  
  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return `#${position}`;
    }
  };

  const getPositionBgColor = (position: number, isCurrentUser: boolean) => {
    if (isCurrentUser) {
      return "bg-blue-50 border-2 border-blue-200 ring-1 ring-blue-300";
    }
    
    switch (position) {
      case 1: return "bg-yellow-50 border-yellow-200";
      case 2: return "bg-gray-50 border-gray-200";
      case 3: return "bg-orange-50 border-orange-200";
      default: return "bg-white border-gray-100";
    }
  };

  const getLevelBadgeColor = (level?: string | null) => {
    if (!level) return "bg-gray-100 text-gray-700";
    
    const levelNum = parseInt(level) || 0;
    if (levelNum <= 2) return "bg-yellow-100 text-yellow-800";
    if (levelNum <= 4) return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-700";
  };

  const getMovementInfo = (position: number) => {
    if (position === 1) {
      return {
        icon: TrendingUp,
        text: "Sube de grupo",
        color: "text-green-600",
        bgColor: "bg-green-50",
      };
    } else if (position === 4) {
      return {
        icon: TrendingDown,
        text: "Baja de grupo",
        color: "text-red-600",
        bgColor: "bg-red-50",
      };
    } else {
      return {
        icon: Minus,
        text: "Se mantiene",
        color: "text-blue-600",
        bgColor: "bg-blue-50",
      };
    }
  };

  const userMovement = currentUser ? getMovementInfo(currentUser.position) : null;

  return (
    <div className="space-y-4">
      {/* Preview de puntos (si está habilitado) */}
      {showPreview && groupId && (
        <PointsPreviewCard
          groupId={groupId}
          currentUserId={currentUserId}
          showAllPlayers={false}
          compact={true}
        />
      )}

      {/* Card principal del grupo */}
      <Card className="shadow-md">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Mi Grupo {number}
            </CardTitle>
            <div className="flex items-center gap-2">
              {level && (
                <Badge className={getLevelBadgeColor(level)}>
                  Nivel {level}
                </Badge>
              )}
              <Badge className="bg-blue-100 text-blue-800">
                Ronda {roundNumber}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="h-6 w-6 p-0"
                title={showPreview ? "Ocultar preview" : "Mostrar preview"}
              >
                {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Lista de jugadores */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Jugadores en tu grupo:
            </h4>
            
            {sortedMembers.map((member) => (
              <div
                key={member.playerId}
                className={`p-3 rounded-lg border transition-all ${getPositionBgColor(
                  member.position,
                  member.isCurrentUser
                )}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-sm font-bold">
                      {getPositionIcon(member.position)}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {member.name}
                        {member.isCurrentUser && (
                          <Badge className="bg-blue-600 text-white text-xs">
                            Tú
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 flex items-center gap-2">
                        <span>{member.points.toFixed(1)} pts</span>
                        {member.streak > 0 && (
                          <span className="flex items-center gap-1 text-orange-600">
                            <Flame className="w-3 h-3" />
                            x{member.streak}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {member.position === 1 && (
                    <Crown className="w-4 h-4 text-yellow-600" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Resumen de posición del usuario (solo posición actual, el preview muestra lo provisional) */}
          {currentUser && userMovement && !showPreview && (
            <div className={`rounded-lg p-4 border border-opacity-50 ${userMovement.bgColor}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-sm mb-1 ${userMovement.color}`}>
                    Tu situación actual
                  </div>
                  <div className="font-bold text-lg text-gray-900">
                    {getPositionIcon(currentUser.position)} Posición {currentUser.position}
                  </div>
                  <div className="text-sm text-gray-600">
                    {currentUser.points.toFixed(1)} puntos
                    {currentUser.streak > 0 && ` • Racha x${currentUser.streak}`}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`flex items-center gap-1 text-sm font-medium ${userMovement.color}`}>
                    <userMovement.icon className="w-4 h-4" />
                    {userMovement.text}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botón para ver detalles completos */}
          <div className="pt-2">
            <Button asChild className="w-full">
              <Link href="/mi-grupo">
                Ver sets y detalles completos
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>

          {/* Información sobre el preview */}
          {showPreview && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              El preview muestra cómo quedarían los puntos con los sets confirmados hasta ahora.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}