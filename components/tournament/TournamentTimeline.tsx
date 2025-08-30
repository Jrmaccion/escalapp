// components/tournament/TournamentTimeline.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils"; // si no tienes este helper, sustituye cn(...) por template strings

type Movement = "up" | "down" | "stay" | "new" | "absent";

type RoundDTO   = { number: number; startDate: string; endDate: string; isClosed: boolean };
type PlayerHistoryPoint = { round: number; group: number | null; movement: Movement };
type PlayerDTO  = { playerId: string; name: string; history: PlayerHistoryPoint[] };
type TimelineAPI = { rounds: RoundDTO[]; players: PlayerDTO[] };

type Props = { tournamentId: string };

// estética movimiento → colores y símbolos
const MOVESTYLES: Record<Movement, { bg: string; text: string; chip: string; label: string }> = {
  up:     { bg: "bg-green-50 border-green-200", text: "text-green-700", chip: "↑", label: "Sube" },
  down:   { bg: "bg-red-50 border-red-200",     text: "text-red-700",   chip: "↓", label: "Baja" },
  stay:   { bg: "bg-blue-50 border-blue-200",   text: "text-blue-700",  chip: "→", label: "Mantiene" },
  new:    { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", chip: "★", label: "Nuevo" },
  absent: { bg: "bg-zinc-50 border-zinc-200",   text: "text-zinc-500",  chip: "·", label: "Ausente" },
};

export default function TournamentTimeline({ tournamentId }: Props) {
  const [data, setData] = useState<TimelineAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [groupFilter, setGroupFilter] = useState<number | "all">("all");

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}/timeline`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("Bad response");
        const json: TimelineAPI = await res.json();
        setData(json);
      } catch (e: any) {
        if (e?.name !== "AbortError") setData(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [tournamentId]);

  const lastRound = data?.rounds.length ? data.rounds[data.rounds.length - 1].number : 1;

  const ranking = useMemo(() => {
    if (!data) return [] as Array<{ playerId: string; name: string; group: number | null; movement: Movement }>;
    return data.players
      .map((p) => {
        const last = p.history.find((h) => h.round === lastRound);
        return {
          playerId: p.playerId,
          name: p.name,
          group: last?.group ?? null,
          movement: (last?.movement ?? "absent") as Movement,
        };
      })
      .sort((a, b) => {
        const ag = a.group ?? 9999, bg = b.group ?? 9999;
        if (ag !== bg) return ag - bg;
        return a.name.localeCompare(b.name);
      });
  }, [data, lastRound]);

  const groupsAvailable = useMemo<number[]>(() => {
    const set = new Set<number>();
    ranking.forEach((r) => { if (typeof r.group === "number") set.add(r.group); });
    return [...set].sort((a, b) => a - b);
  }, [ranking]);

  const filteredPlayers = useMemo(() => {
    if (!data) return [] as PlayerDTO[];
    const nameFilter = (n: string) => (q ? n.toLowerCase().includes(q.toLowerCase()) : true);
    const idsFilteredByName = new Set(
      data.players.filter((p) => nameFilter(p.name)).map((p) => p.playerId)
    );
    const idsFilteredByGroup =
      groupFilter === "all"
        ? null
        : new Set(ranking.filter((r) => r.group === groupFilter).map((r) => r.playerId));

    return data.players
      .filter((p) => idsFilteredByName.has(p.playerId))
      .filter((p) => (idsFilteredByGroup ? idsFilteredByGroup.has(p.playerId) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, q, groupFilter, ranking]);

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardHeader><CardTitle>Estado del torneo</CardTitle></CardHeader>
        <CardContent>Cargando…</CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="shadow-sm">
        <CardHeader><CardTitle>Estado del torneo</CardTitle></CardHeader>
        <CardContent>No hay datos.</CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="board" className="w-full">
      <TabsList>
        <TabsTrigger value="board">Clasificación</TabsTrigger>
        <TabsTrigger value="timeline">Movimientos (tablero)</TabsTrigger>
      </TabsList>

      {/* Tabla rápida de clasificación actual */}
      <TabsContent value="board" className="mt-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-2">
            <CardTitle>Clasificación actual (por grupo)</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar jugador…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="max-w-xs"
              />
              <select
                aria-label="Filtrar por grupo"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="border rounded-md px-2 py-1 bg-background"
              >
                <option value="all">Todos los grupos</option>
                {groupsAvailable.map((g) => (
                  <option key={g} value={g}>Grupo {g}</option>
                ))}
              </select>
              <div className="ml-auto flex items-center gap-2 text-sm">
                <Badge variant="secondary">↑ Sube</Badge>
                <Badge variant="secondary">↓ Baja</Badge>
                <Badge variant="secondary">→ Mantiene</Badge>
                <Badge variant="secondary">★ Nuevo</Badge>
                <Badge variant="outline">· Ausente</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">Jugador</th>
                    <th className="py-2 pr-4">Grupo</th>
                    <th className="py-2 pr-4">Movimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking
                    .filter((r) => (groupFilter === "all" ? true : r.group === groupFilter))
                    .filter((r) => (q ? r.name.toLowerCase().includes(q.toLowerCase()) : true))
                    .map((r) => (
                      <tr key={r.playerId} className="border-b">
                        <td className="py-2 pr-4">{r.name}</td>
                        <td className="py-2 pr-4">{r.group ?? "—"}</td>
                        <td className="py-2 pr-4">{MOVESTYLES[r.movement].chip} {MOVESTYLES[r.movement].label}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tablero horizontal de movimientos */}
      <TabsContent value="timeline" className="mt-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-2">
            <CardTitle>Movimientos por ronda (tablero)</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar jugador…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="max-w-xs"
              />
              <select
                aria-label="Filtrar por grupo"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="border rounded-md px-2 py-1 bg-background"
              >
                <option value="all">Todos los grupos</option>
                {groupsAvailable.map((g) => (
                  <option key={g} value={g}>Grupo {g}</option>
                ))}
              </select>
              <div className="ml-auto flex items-center gap-2 text-xs sm:text-sm">
                {(["up","down","stay","new","absent"] as Movement[]).map((m) => (
                  <span
                    key={m}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded border",
                      MOVESTYLES[m].bg, MOVESTYLES[m].text
                    )}
                  >
                    {MOVESTYLES[m].chip} {MOVESTYLES[m].label}
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {/* Grid: 1 col fija de nombres + N cols de rondas */}
              <div
                className="inline-grid"
                style={{
                  gridTemplateColumns: `minmax(180px, 220px) repeat(${data.rounds.length}, 120px)`,
                }}
              >
                {/* Cabecera */}
                <div className="sticky left-0 z-10 bg-background/80 backdrop-blur border-b border-r px-3 py-2 font-medium">
                  Jugador
                </div>
                {data.rounds.map((r) => (
                  <div key={r.number} className="border-b px-3 py-2 text-sm font-medium text-center">
                    Ronda {r.number}
                  </div>
                ))}

                {/* Filas por jugador */}
                {filteredPlayers.map((p) => (
                  <React.Fragment key={p.playerId}>
                    {/* Nombre (sticky) */}
                    <div
                      className="sticky left-0 z-10 bg-background/80 backdrop-blur border-r px-3 py-2 whitespace-nowrap"
                    >
                      {p.name}
                    </div>

                    {/* Celdas por ronda */}
                    {data.rounds.map((r) => {
                      const h = p.history.find((hh) => hh.round === r.number);
                      const move = (h?.movement ?? "absent") as Movement;
                      const style = MOVESTYLES[move];
                      return (
                        <div
                          key={`${p.playerId}-${r.number}`}
                          className={cn(
                            "px-2 py-2 border-r border-b flex flex-col items-center justify-center text-xs rounded-none",
                            "transition-colors",
                            style.bg, style.text
                          )}
                          title={`${p.name} · Ronda ${r.number} · ${style.label}${h?.group ? ` · Grupo ${h.group}` : ""}`}
                        >
                          <div className="font-semibold text-base leading-none">{style.chip}</div>
                          <div className="mt-1">
                            {h?.group ? <span className="font-medium">G{h.group}</span> : <span className="opacity-60">—</span>}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
