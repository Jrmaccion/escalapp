"use client";

import { useState, useEffect } from "react";
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
import { Calendar } from "lucide-react";

type EditRoundDatesDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roundId: string;
  initialStartDate: Date;
  initialEndDate: Date;
  onSuccess: () => void;
};

export default function EditRoundDatesDialog({
  open,
  onOpenChange,
  roundId,
  initialStartDate,
  initialEndDate,
  onSuccess,
}: EditRoundDatesDialogProps) {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper para convertir Date a formato datetime-local
  const toLocalInputValue = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mi = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };

  useEffect(() => {
    if (open) {
      setStartDate(toLocalInputValue(initialStartDate));
      setEndDate(toLocalInputValue(initialEndDate));
      setError(null);
    }
  }, [open, initialStartDate, initialEndDate]);

  const handleSave = async () => {
    setError(null);

    // Validar que las fechas sean válidas
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setError("Fechas inválidas");
      return;
    }

    if (start >= end) {
      setError("La fecha de inicio debe ser anterior a la fecha de fin");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/rounds/${roundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Error al actualizar las fechas");
        return;
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error("Error updating round dates:", err);
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="edit-dates-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Editar Fechas de Ronda
          </DialogTitle>
        </DialogHeader>

        <DialogDescription id="edit-dates-desc">
          Modifica las fechas de inicio y fin de la ronda. La fecha de inicio debe ser anterior a
          la fecha de fin.
        </DialogDescription>

        <div className="grid gap-4 py-2">
          <div>
            <Label htmlFor="start-date">Fecha de Inicio</Label>
            <Input
              id="start-date"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="end-date">Fecha de Fin</Label>
            <Input
              id="end-date"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={loading}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
