"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type MatchEditDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTeam1Games?: number | null;
  initialTeam2Games?: number | null;
  initialTiebreakScore?: string | null;
  onSubmit: (data: {
    team1Games: number;
    team2Games: number;
    tiebreakScore: string | null;
    photoUrl?: string | null;
  }) => Promise<void>;
};

const scoreSchema = z.object({
  team1Games: z.number().min(0).max(7),
  team2Games: z.number().min(0).max(7),
  tiebreakScore: z
    .string()
    .regex(/^\d+-\d+$/, "Formato de tie-break inválido (ej: 7-5)")
    .nullable()
    .optional(),
});

export default function MatchEditDialog({
  open,
  onOpenChange,
  initialTeam1Games,
  initialTeam2Games,
  initialTiebreakScore,
  onSubmit,
}: MatchEditDialogProps) {
  const { data: session } = useSession();

  const [team1, setTeam1] = useState<number>(initialTeam1Games ?? 0);
  const [team2, setTeam2] = useState<number>(initialTeam2Games ?? 0);
  const [tiebreak, setTiebreak] = useState<string>(initialTiebreakScore ?? "");
  const [photoUrl, setPhotoUrl] = useState<string>("");

  useEffect(() => {
    setTeam1(initialTeam1Games ?? 0);
    setTeam2(initialTeam2Games ?? 0);
    setTiebreak(initialTiebreakScore ?? "");
  }, [initialTeam1Games, initialTeam2Games, initialTiebreakScore]);

  const needsTiebreak = useMemo(() => {
    const a = Number(team1);
    const b = Number(team2);
    return (a === 4 && b === 4) || (a === 6 && b === 6);
  }, [team1, team2]);

  async function handleSave() {
    const data = {
      team1Games: Number(team1),
      team2Games: Number(team2),
      tiebreakScore: tiebreak ? tiebreak : null,
      photoUrl: photoUrl || null,
    };

    // Validación ligera en cliente
    const parsed = scoreSchema.safeParse(data);
    if (!parsed.success) {
      alert(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    if (needsTiebreak && !tiebreak) {
      alert("Debes indicar el tie-break cuando el set fue 4-4 o 6-6.");
      return;
    }

    await onSubmit(data);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="match-edit-desc">
        <DialogHeader>
          <DialogTitle>Editar resultado</DialogTitle>
        </DialogHeader>

        {/* 👇 Accesible: descripción para el contenido del dialog */}
        <DialogDescription id="match-edit-desc">
          Introduce los juegos de cada equipo y, si fue 4-4 o 6-6, añade el tie-break con
          formato “7-5”, “10-8”, etc.
        </DialogDescription>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="team1">Juegos Equipo 1</Label>
              <Input
                id="team1"
                type="number"
                min={0}
                max={7}
                value={team1}
                onChange={(e) => setTeam1(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="team2">Juegos Equipo 2</Label>
              <Input
                id="team2"
                type="number"
                min={0}
                max={7}
                value={team2}
                onChange={(e) => setTeam2(Number(e.target.value))}
              />
            </div>
          </div>

          {needsTiebreak && (
            <div>
              <Label htmlFor="tb">Tie-break (ej: 7-5)</Label>
              <Input
                id="tb"
                placeholder="ej: 7-5"
                value={tiebreak}
                onChange={(e) => setTiebreak(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="photo">URL de foto (opcional)</Label>
            <Input
              id="photo"
              placeholder="https://…"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
