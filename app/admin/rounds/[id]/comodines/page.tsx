// app/admin/rounds/[id]/comodines/page.tsx
import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Breadcrumbs from "@/components/Breadcrumbs"; // default export
import ComodinManagement from "@/components/admin/ComodinManagement";

// Evita prerender en build y accesos a DB en tiempo de build
export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

async function getRoundData(roundId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      tournament: { select: { id: true, title: true } },
    },
  });
  if (!round) notFound();
  return round;
}

export default async function AdminRoundComodinesPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!(session.user as any)?.isAdmin) redirect("/dashboard");

  const round = await getRoundData(params.id);

  const breadcrumbItems = [
    { label: "Admin", href: "/admin" },
    { label: "Rondas", href: "/admin/rounds" },
    { label: `Ronda ${round.number}`, href: `/admin/rounds/${round.id}` },
    { label: "Comodines", href: `/admin/rounds/${round.id}/comodines` },
  ];

  return (
    <div className="space-y-6 px-4 py-6 max-w-6xl mx-auto">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Comodines</h1>
              <p className="text-gray-600">
                {round.tournament.title} — Ronda {round.number}
              </p>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                (round as any).isClosed ? "bg-gray-100 text-gray-800" : "bg-green-100 text-green-800"
              }`}
            >
              {(round as any).isClosed ? "Cerrada" : "Activa"}
            </span>
          </div>
        </div>

        <div className="p-6">
          <Suspense
            fallback={<div className="text-center py-8 text-gray-500">Cargando gestión de comodines...</div>}
          >
            <ComodinManagement
              roundId={round.id}
              roundNumber={round.number}
              tournamentName={round.tournament.title}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
