// components/player/UseComodinButton.tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  roundId: string;            // Ronda actual del jugador
  disabled?: boolean;         // Por si quieres bloquear según condiciones externas
  className?: string;
};

export default function UseComodinButton({ roundId, disabled, className }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [used, setUsed] = useState(false);

  const onClick = () => {
    setMsg(null); setErr(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/comodin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roundId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErr(data?.error ?? "No se pudo aplicar el comodín.");
          return;
        }
        setUsed(true);
        setMsg(data?.message ?? "Comodín aplicado.");
      } catch (e) {
        setErr("Error de conexión.");
      }
    });
  };

  return (
    <div className={className}>
      <Button
        type="button"
        onClick={onClick}
        disabled={disabled || pending || used}
        className="w-full"
      >
        {used ? "Comodín aplicado" : pending ? "Aplicando…" : "Usar comodín"}
      </Button>
      {msg && <p className="mt-2 text-sm text-green-700">{msg}</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {!used && !pending && (
        <p className="mt-2 text-xs text-gray-500">
          Se asignará la media del grupo (R1–R2) o tu media personal (desde R3).
          No cuenta como ronda jugada.
        </p>
      )}
    </div>
  );
}
