"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Unlock } from "lucide-react";

type Props = {
  roundId: string;
};

export default function ReopenRoundButton({ roundId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onReopen = () => {
    const confirmed = confirm(
      "¿Estás seguro de que deseas reabrir esta ronda?\n\n" +
      "LIMPIEZA AUTOMÁTICA - Se revertirán:\n" +
      "✓ Puntos de rachas de continuidad\n" +
      "✓ Puntos técnicos de grupos no disputados\n" +
      "✓ Estados de grupos (volverán a PENDING)\n" +
      "✓ Historial de rachas\n\n" +
      "SE CONSERVARÁN:\n" +
      "• Resultados de partidos confirmados\n" +
      "• Rankings (se recalcularán al cerrar de nuevo)\n\n" +
      "DESPUÉS DE REABRIR:\n" +
      "- Podrás editar grupos y jugadores\n" +
      "- Podrás modificar resultados de partidos\n" +
      "- Si existe ronda siguiente, deberás regenerarla manualmente\n\n" +
      "Al volver a cerrar, todos los cálculos se harán desde cero."
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/rounds/${roundId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isClosed: false }),
        });

        const txt = await res.text();
        if (!res.ok) {
          try {
            const j = JSON.parse(txt);
            setError(j?.error || "No se pudo reabrir la ronda");
            alert(j?.error || "No se pudo reabrir la ronda");
          } catch {
            setError(txt || "No se pudo reabrir la ronda");
            alert(txt || "No se pudo reabrir la ronda");
          }
          return;
        }

        // Éxito: recargar la página
        window.location.reload();
      } catch (e: any) {
        console.error("Error de conexión:", e);
        setError("Error de conexión");
        alert("Error de conexión");
      }
    });
  };

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <Button variant="outline" onClick={onReopen} disabled={isPending}>
        <Unlock className="w-4 h-4 mr-2" />
        {isPending ? "Reabriendo..." : "Reabrir Ronda"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
