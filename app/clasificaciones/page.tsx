import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Breadcrumbs from "@/components/Breadcrumbs";
import ClasificacionesClient from "./ClasificacionesClient";

export const metadata = {
  title: "Clasificaciones | PadelRise",
  description: "Ranking oficial por promedio e Ironman por puntos totales",
};

export default async function ClasificacionesPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }

  // Check for player profile
  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  // Redirect if no player profile
  if (!player) {
    if (session.user?.isAdmin) {
      redirect("/admin");
    } else {
      redirect("/dashboard");
    }
  }

  const items = [
    { label: "Inicio", href: "/dashboard" },
    { label: "Clasificaciones", current: true },
  ];

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-6">
      <Breadcrumbs items={items} />
      <ClasificacionesClient />
    </div>
  );
}
