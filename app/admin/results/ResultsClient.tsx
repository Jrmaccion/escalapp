"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Info, Edit, ArrowLeft, LayoutDashboard } from "lucide-react";
import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import toast from "react-hot-toast";
import Link from "next/link";

type SerializedMatch = {
  id: string;
  roundNumber: string | number;
  groupNumber: string | number;
  setNumber: number;
  team1Games: number;
  team2Games: number;
  tiebreakScore: string | null;
  score: string;
  team1: string[];
  team2: string[];
  reportedBy: string;
  photoUrl?: string;
};

type ResultsClientProps = {
  pendingMatches: SerializedMatch[];
};

export default function ResultsClient({ pendingMatches }: ResultsClientProps) {
  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header con navegación */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" asChild>
              <Link href="/admin/rounds">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Rondas
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard Admin
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Resultados pendientes</h1>
          <p className="text-gray-600">Revisa y valida las actas reportadas por los jugadores.</p>
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Actas en revisión</CardTitle>
            <Badge variant="secondary">{pendingMatches.length} pendientes</Badge>
          </CardHeader>
          <CardContent>
            {pendingMatches.length === 0 ? (
              <p className="text-sm text-gray-500">No hay resultados pendientes ahora mismo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2 pr-3">Ronda</th>
                      <th className="py-2 pr-3">Grupo</th>
                      <th className="py-2 pr-3">Set</th>
                      <th className="py-2 pr-3">Parejas</th>
                      <th className="py-2 pr-3">Marcador</th>
                      <th className="py-2 pr-3">Reportado por</th>
                      <th className="py-2 pr-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingMatches.map((match) => (
                      <Row key={match.id} match={match} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ match }: { match: SerializedMatch }) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Estado de edición separado del estado de visualización
  const [editT1, setEditT1] = useState<number>(match.team1Games ?? 0);
  const [editT2, setEditT2] = useState<number>(match.team2Games ?? 0);
  const [editTB, setEditTB] = useState<string>(match.tiebreakScore ?? "");
  const [validationError, setValidationError] = useState<string>("");

  const resetEditState = () => {
    setEditT1(match.team1Games ?? 0);
    setEditT2(match.team2Games ?? 0);
    setEditTB(match.tiebreakScore ?? "");
    setValidationError("");
    setIsEditing(false);
  };

  const openModal = (editMode = false) => {
    resetEditState();
    setIsEditing(editMode);
    setOpen(true);
  };

  const approve = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/matches/${match.id}/confirm`, { 
          method: "PATCH" 
        });
        if (res.ok) {
          toast.success("Resultado aprobado");
          window.location.reload();
        } else {
          const errorText = await res.text();
          toast.error(`Error: ${errorText}`);
        }
      } catch (error) {
        toast.error("Error de conexión al aprobar");
      }
    });
  };

  const reject = () => {
    const confirmReject = confirm("¿Seguro que quieres rechazar este resultado?");
    if (!confirmReject) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/matches/${match.id}/reject`, { 
          method: "POST" 
        });
        if (res.ok) {
          toast("Resultado rechazado", { icon: "🗑️" });
          window.location.reload();
        } else {
          const errorText = await res.text();
          toast.error(`Error: ${errorText}`);
        }
      } catch (error) {
        toast.error("Error de conexión al rechazar");
      }
    });
  };

  const saveChanges = () => {
    const validation = validateGames(editT1, editT2, editTB);
    if (!validation.ok) {
      setValidationError(validation.message || "Error de validación");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/matches/${match.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            team1Games: editT1, 
            team2Games: editT2, 
            tiebreakScore: validation.tb || null 
          }),
        });

        if (res.ok) {
          toast.success("Cambios guardados");
          setOpen(false);
          window.location.reload();
        } else {
          const errorText = await res.text();
          toast.error(`Error al guardar: ${errorText}`);
        }
      } catch (error) {
        toast.error("Error de conexión al guardar");
      }
    });
  };

  return (
    <>
      <tr className="border-t">
        <td className="py-3 pr-3">Ronda {match.roundNumber}</td>
        <td className="py-3 pr-3">Grupo {match.groupNumber}</td>
        <td className="py-3 pr-3">Set {match.setNumber}</td>
        <td className="py-3 pr-3">
          <div className="flex flex-col">
            <span className="font-medium">{match.team1.join(" + ")}</span>
            <span className="text-gray-500">{match.team2.join(" + ")}</span>
          </div>
        </td>
        <td className="py-3 pr-3">
          <div className="flex items-center gap-2">
            {/* Siempre mostrar los datos del servidor */}
            <Badge variant="outline">{match.team1Games}-{match.team2Games}</Badge>
            {match.tiebreakScore && (
              <Badge variant="secondary">TB {match.tiebreakScore}</Badge>
            )}
          </div>
        </td>
        <td className="py-3 pr-3">{match.reportedBy}</td>
        <td className="py-3 pr-3">
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => openModal(false)}
            >
              <Info className="w-4 h-4 mr-1" /> Ver
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => openModal(true)}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <Edit className="w-4 h-4 mr-1" /> Editar
            </Button>
            <Button 
              size="sm" 
              onClick={approve} 
              disabled={isPending} 
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-1" /> Aprobar
            </Button>
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={reject} 
              disabled={isPending}
            >
              <X className="w-4 h-4 mr-1" /> Rechazar
            </Button>
          </div>
        </td>
      </tr>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar resultado" : "Detalle del resultado"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 text-sm">
            <div className="grid grid-cols-2 gap-2 text-gray-600">
              <div><strong>Ronda:</strong> {match.roundNumber}</div>
              <div><strong>Grupo:</strong> {match.groupNumber}</div>
            </div>
            
            <div><strong>Set:</strong> {match.setNumber}</div>

            <div className="space-y-2">
              <div><strong>Equipo 1:</strong> {match.team1.join(" + ")}</div>
              <div><strong>Equipo 2:</strong> {match.team2.join(" + ")}</div>
            </div>

            {isEditing ? (
              <div className="space-y-4 p-4 bg-gray-50 rounded">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Games Equipo 1
                    </label>
                    <input 
                      type="number" 
                      min={0} 
                      max={6} 
                      value={editT1} 
                      onChange={(e) => {
                        setEditT1(Number(e.target.value));
                        setValidationError("");
                      }} 
                      className="w-full border rounded px-2 py-1 text-center" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Games Equipo 2
                    </label>
                    <input 
                      type="number" 
                      min={0} 
                      max={6} 
                      value={editT2} 
                      onChange={(e) => {
                        setEditT2(Number(e.target.value));
                        setValidationError("");
                      }} 
                      className="w-full border rounded px-2 py-1 text-center" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Tie-break (opcional - ej: 7-5)
                  </label>
                  <input 
                    type="text" 
                    placeholder="7-5" 
                    value={editTB} 
                    onChange={(e) => {
                      setEditTB(e.target.value);
                      setValidationError("");
                    }} 
                    className="w-full border rounded px-2 py-1" 
                  />
                </div>

                {validationError && (
                  <div className="text-red-600 text-xs bg-red-50 p-2 rounded">
                    {validationError}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div><strong>Marcador:</strong> {match.team1Games}-{match.team2Games}</div>
                {match.tiebreakScore && (
                  <div><strong>Tie-break:</strong> {match.tiebreakScore}</div>
                )}
                <div><strong>Reportado por:</strong> {match.reportedBy}</div>
              </div>
            )}

            {match.photoUrl && (
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-700 mb-2">Foto del acta</div>
                <img 
                  src={match.photoUrl} 
                  alt="Acta del partido" 
                  className="w-full h-auto rounded border max-h-64 object-contain" 
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {isEditing ? "Cancelar" : "Cerrar"}
            </Button>
            
            {isEditing ? (
              <Button 
                onClick={saveChanges} 
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Guardar cambios
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <Edit className="w-4 h-4 mr-1" /> Editar
                </Button>
                <Button 
                  onClick={approve} 
                  disabled={isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-4 h-4 mr-1" /> Aprobar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Validación simplificada y más flexible
function validateGames(team1Games: number, team2Games: number, tiebreakScore: string): {
  ok: boolean;
  message?: string;
  tb?: string;
} {
  // Validar que los números estén en rango válido
  if (team1Games < 0 || team1Games > 6 || team2Games < 0 || team2Games > 6) {
    return { 
      ok: false, 
      message: "Los games deben estar entre 0 y 6" 
    };
  }

  // Si no hay números, es inválido
  if (isNaN(team1Games) || isNaN(team2Games)) {
    return { 
      ok: false, 
      message: "Debe ingresar números válidos" 
    };
  }

  // Verificar tie-break si es necesario
  if (tiebreakScore && tiebreakScore.trim()) {
    if (!/^\d{1,2}-\d{1,2}$/.test(tiebreakScore.trim())) {
      return { 
        ok: false, 
        message: "Formato de tie-break inválido. Use formato: 7-5" 
      };
    }
  }

  // Validación básica: alguien debe ganar
  if (team1Games === team2Games && (!tiebreakScore || !tiebreakScore.trim())) {
    return { 
      ok: false, 
      message: "No puede haber empate. Si fue tie-break, ingrese el resultado" 
    };
  }

  return { 
    ok: true, 
    tb: tiebreakScore?.trim() || "" 
  };
}