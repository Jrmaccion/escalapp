// app/diag/page.tsx
"use client";
import { useEffect, useState } from "react";

type Diag = {
  env: Record<string, any>;
  db: { ok: boolean; error?: string };
  counts: { users?: number; players?: number; tournaments?: number };
  session: any;
};

export default function DiagPage() {
  const [data, setData] = useState<Diag | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/diag")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <pre className="p-4 text-red-600">{err}</pre>;
  if (!data) return <p className="p-4">Cargando…</p>;

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-bold">Diagnóstico</h1>
      <section>
        <h2 className="font-semibold">Entorno</h2>
        <pre className="bg-gray-50 p-3 rounded">{JSON.stringify(data.env, null, 2)}</pre>
      </section>
      <section>
        <h2 className="font-semibold">Base de datos</h2>
        <pre className="bg-gray-50 p-3 rounded">{JSON.stringify(data.db, null, 2)}</pre>
      </section>
      <section>
        <h2 className="font-semibold">Contadores</h2>
        <pre className="bg-gray-50 p-3 rounded">{JSON.stringify(data.counts, null, 2)}</pre>
      </section>
      <section>
        <h2 className="font-semibold">Sesión</h2>
        <pre className="bg-gray-50 p-3 rounded">{JSON.stringify(data.session, null, 2)}</pre>
      </section>
    </main>
  );
}
