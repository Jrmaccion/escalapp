// app/admin/results/AdminResultsClient.tsx - AJUSTADO A ApiStateComponents
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { LoadingState, ErrorState, UpdateBadge } from "@/components/ApiStateComponents";
import { useAdminResults } from "@/hooks/useApiState";

type AdminStats = {
  pendingMatches: number;
  confirmedMatches: number;
  totalMatches: number;
};

export default function AdminResultsClient() {
  const {
    data,
    loading: isLoading,
    error,
    retry,
    hasUpdates,
  } = useAdminResults();
  const [isPending] = useTransition();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 max-w-7xl">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 max-w-7xl">
          <ErrorState error={error} onRetry={retry} />
        </div>
      </div>
    );
  }

  const stats: AdminStats = data?.stats ?? {
    pendingMatches: 0,
    confirmedMatches: 0,
    totalMatches: 0,
  };

  const pending = Array.isArray(data?.pending) ? data.pending : [];

  const validarPendientes = async () => {
    const ids = pending.map((m: any) => m.id);
    if (ids.length === 0) {
      alert("No hay resultados pendientes para validar");
      return;
    }
    const res = await fetch("/api/admin/results", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchIds: ids, action: "validate_pending" }),
    });
    if (res.ok) {
      const r = await res.json();
      alert(`${r.message} (${ids.length} sets validados)`);
      retry();
    } else {
      const e = await res.json().catch(() => ({}));
      alert(e?.error || "Error en la validación");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Validar Resultados</h1>
            <p className="text-gray-600">Gestión rápida de sets pendientes</p>
          </div>
          <Button onClick={retry} disabled={isPending} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>

        <UpdateBadge onRefresh={retry} show={!!hasUpdates} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingMatches}</div>
              <div className="text-sm text-gray-600">Pendientes</div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.confirmedMatches}</div>
              <div className="text-sm text-gray-600">Confirmados</div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalMatches}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </Card>
        </div>

        {/* Lista de pendientes (muy simple) */}
        <div className="space-y-2">
          {pending.length === 0 ? (
            <p className="text-sm text-gray-600">No hay sets pendientes ahora mismo.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  {pending.length} sets pendientes de validación
                </p>
                <Button onClick={validarPendientes}>Validar todos</Button>
              </div>
              <ul className="text-sm text-gray-700 list-disc ml-5">
                {pending.map((m: any) => (
                  <li key={m.id}>
                    Set {m.setNumber} (grupo {m.groupNumber}) — {m.reportedByName ?? "N/D"}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
