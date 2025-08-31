"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CheckCircle, Save, X } from "lucide-react";

type MatchEdit = {
  id: string;
  groupNumber?: number;
  setNumber?: number | null;
  team1Games?: number | null;
  team2Games?: number | null;
  tiebreakScore?: string | null;
};

type Props = {
  isAdmin?: boolean;
  match: MatchEdit;
  onClose: () => void;
  onSaved: () => void;
};

function isIntIn(v: any, min: number, max: number) {
  if (v === "" || v === null || v === undefined) return false;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max;
}

export default function MatchEditDialog({ isAdmin = true, match, onClose, onSaved }: Props) {
  const [team1Games, setTeam1Games] = useState<string>(match.team1Games?.toString() ?? "");
  const [team2Games, setTeam2Games] = useState<string>(match.team2Games?.toString() ?? "");
  const [tiebreakScore, setTiebreakScore] = useState<string>(match.tiebreakScore ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    if (!isIntIn(team1Games, 0, 5) || !isIntIn(team2Games, 0, 5)) {
      setError("Los juegos deben estar entre 0 y 5.");
      return false;
    }
    const a = Number(team1Games);
    const b = Number(team2Games);

    const isTie = a === 4 && b === 4;
    if (isTie && !tiebreakScore.trim()) {
      setError("Si el set es 4–4, debes indicar el marcador del tie-break (ej. 7-5).");
      return false;
    }

    const validRegular =
      (a === 4 && b <= 2) || (b === 4 && a <= 2) || (a === 5 && b === 4) || (b === 5 && a === 4);

    if (!isTie && !validRegular) {
      setError("Marcador inválido para las reglas del set.");
      return false;
    }
    return true;
  };

  const save = async () => {
    setError(null);
    if (!validate()) return;
    setSaving(true);
    try {
      // Con tu API:
      // - Admin: PATCH sin action -> fuerza confirmación.
      // - Jugador: PATCH con action='report' -> reporta sin confirmar.
      const payload: any = {
        team1Games: Number(team1Games),
        team2Games: Number(team2Games),
        tiebreakScore: tiebreakScore.trim() || null,
      };
      if (!isAdmin) payload.action = "report";

      const res = await fetch(`/api/matches/${match.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar el set");
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Error guardando el set");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Set — Grupo {match.groupNumber ?? "—"} · Set {match.setNumber ?? "—"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && <div className="p-2 text-sm rounded border bg-red-50 text-red-700">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Juegos Equipo 1</Label>
              <Input
                inputMode="numeric"
                value={team1Games}
                placeholder="0–5"
                onChange={(e) => setTeam1Games(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
            <div>
              <Label>Juegos Equipo 2</Label>
              <Input
                inputMode="numeric"
                value={team2Games}
                placeholder="0–5"
                onChange={(e) => setTeam2Games(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
          </div>

          <div>
            <Label>Tie-break (si 4–4)</Label>
            <Input
              value={tiebreakScore}
              placeholder="7-5"
              onChange={(e) => setTiebreakScore(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Se guardará el marcador real del TB; el set computará como 5–4 para el ganador.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-1" />
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2 animate-pulse" />
                Guardando…
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
