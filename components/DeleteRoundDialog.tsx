"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { AlertTriangle, Trash2 } from "lucide-react";

type DeleteRoundDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roundId: string;
  roundNumber: number;
  tournamentId: string;
  isClosed: boolean;
  totalGroups: number;
  totalMatches: number;
  confirmedMatches: number;
};

export default function DeleteRoundDialog({
  open,
  onOpenChange,
  roundId,
  roundNumber,
  tournamentId,
  isClosed,
  totalGroups,
  totalMatches,
  confirmedMatches,
}: DeleteRoundDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const canDelete = !isClosed && confirmedMatches === 0;
  const expectedConfirmText = `ELIMINAR RONDA ${roundNumber}`;

  const handleDelete = async () => {
    setError(null);

    if (confirmText !== expectedConfirmText) {
      setError(`Por favor escribe exactamente: ${expectedConfirmText}`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/rounds/${roundId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Error al eliminar la ronda");
        return;
      }

      // Redirigir al torneo después de eliminar
      router.push(`/admin/tournaments/${tournamentId}`);
      router.refresh();
    } catch (err) {
      console.error("Error deleting round:", err);
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="delete-round-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Eliminar Ronda {roundNumber}
          </DialogTitle>
        </DialogHeader>

        <DialogDescription id="delete-round-desc">
          Esta acción es irreversible y eliminará permanentemente la ronda y todos sus datos
          asociados.
        </DialogDescription>

        <div className="space-y-4 py-2">
          {/* Impacto de la eliminación */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-yellow-900">Impacto de la eliminación:</h4>
            <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
              <li>
                <strong>{totalGroups}</strong> grupo{totalGroups !== 1 ? "s" : ""} serán
                eliminados
              </li>
              <li>
                <strong>{totalMatches}</strong> partido{totalMatches !== 1 ? "s" : ""} (sets)
                serán eliminados
              </li>
              <li>Todas las rachas de continuidad de esta ronda se perderán</li>
              <li>Los rankings históricos se mantendrán</li>
            </ul>
          </div>

          {/* Restricciones y advertencias */}
          {!canDelete && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                No se puede eliminar esta ronda
              </h4>
              <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                {isClosed && <li>La ronda está cerrada</li>}
                {confirmedMatches > 0 && (
                  <li>
                    Hay {confirmedMatches} partido{confirmedMatches !== 1 ? "s" : ""} confirmado
                    {confirmedMatches !== 1 ? "s" : ""}
                  </li>
                )}
              </ul>
              <p className="text-sm text-red-700 mt-2">
                Solo puedes eliminar rondas que no estén cerradas y que no tengan partidos
                confirmados.
              </p>
            </div>
          )}

          {canDelete && (
            <>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
                <strong>⚠️ Advertencia:</strong> Si esta no es la última ronda del torneo, los
                movimientos de escalera de las siguientes rondas podrían quedar inválidos.
              </div>

              <div>
                <Label htmlFor="confirm-text" className="text-sm">
                  Para confirmar, escribe:{" "}
                  <span className="font-mono font-semibold">{expectedConfirmText}</span>
                </Label>
                <Input
                  id="confirm-text"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={loading}
                  placeholder={expectedConfirmText}
                  className="mt-2"
                />
              </div>
            </>
          )}

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
          {canDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || confirmText !== expectedConfirmText}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {loading ? "Eliminando..." : "Eliminar Ronda"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
