// lib/hooks/useRankingsData.ts - Hook compartido para datos de rankings
"use client";

import { useState, useEffect, useCallback } from "react";

export type RankingType = "official" | "ironman";

export type RankingPlayer = {
  playerId: string;
  playerName: string;
  position: number;
  ironmanPosition: number;
  totalPoints: number;
  averagePoints: number;
  roundsPlayed: number;
  movement: string;
  isCurrentUser?: boolean;
};

export type RankingsData = {
  official: RankingPlayer[];
  ironman: RankingPlayer[];
  totalPlayers: number;
  tournamentId: string;
  tournamentTitle: string;
  roundNumber: number;
};

type UseRankingsDataOptions = {
  tournamentId?: string;
  autoFetch?: boolean;
};

export function useRankingsData(options: UseRankingsDataOptions = {}) {
  const { tournamentId, autoFetch = true } = options;

  const [data, setData] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const url = tournamentId
        ? `/api/rankings?tournamentId=${tournamentId}`
        : `/api/rankings`;

      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Transformar datos al formato esperado
      const officialRankings: RankingPlayer[] = result.official || [];
      const ironmanRankings: RankingPlayer[] = result.ironman || [];

      setData({
        official: officialRankings,
        ironman: ironmanRankings,
        totalPlayers: officialRankings.length,
        tournamentId: result.tournamentId || "",
        tournamentTitle: result.tournamentTitle || "",
        roundNumber: result.roundNumber || 0,
      });
    } catch (err: any) {
      console.error("Error fetching rankings:", err);
      setError(err.message || "Error al cargar rankings");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (autoFetch) {
      fetchRankings();
    }
  }, [autoFetch, fetchRankings]);

  const refresh = useCallback(() => {
    fetchRankings();
  }, [fetchRankings]);

  const getPlayerRanking = useCallback(
    (playerId: string, type: RankingType = "official") => {
      if (!data) return null;
      const rankings = type === "official" ? data.official : data.ironman;
      return rankings.find((p) => p.playerId === playerId);
    },
    [data]
  );

  return {
    data,
    loading,
    error,
    refresh,
    getPlayerRanking,
  };
}
