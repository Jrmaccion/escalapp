"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type Props = {
  roundId: string;
};

export default function CloseRoundButton({ roundId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClose = () => {
    const confirmed = confirm("¿Cerrar esta ronda y aplicar movimientos?");
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/rounds/${roundId}/close`, { method: "POST" });
        const txt = await res.text();
        if (!res.ok) {
          // Puede venir como JSON o texto plano: intentamos parsear
          try {
            const j = JSON.parse(txt);
            setError(j?.error || "No se pudo cerrar la ronda");
            alert(j?.error || "No se pudo cerrar la ronda");
          } catch {
            setError(txt || "No se pudo cerrar la ronda");
            alert(txt || "No se pudo cerrar la ronda");
          }
          return;
        }

        // OK: intentamos leer nextRoundId para redirigir si existe
        let nextRoundId: string | null = null;
        try {
          const j = JSON.parse(txt);
          nextRoundId = typeof j?.nextRoundId === "string" ? j.nextRoundId : null;
        } catch {
          // si no es JSON, recargamos
        }

        if (nextRoundId) {
          // Navega directamente a la siguiente ronda
          window.location.href = `/admin/rounds/${nextRoundId}`;
        } else {
          // No hay siguiente ronda -> recarga
          window.location.reload();
        }
      } catch (e: any) {
        console.error("Error de conexión:", e);
        setError("Error de conexión");
        alert("Error de conexión");
      }
    });
  };

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <Button variant="outline" onClick={onClose} disabled={isPending}>
        <X className="w-4 h-4 mr-2" />
        {isPending ? "Cerrando..." : "Cerrar Ronda"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
