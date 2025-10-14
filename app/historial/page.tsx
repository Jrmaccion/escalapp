// app/historial/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HistorialClient from "./HistorialClient";

export const metadata = {
  title: "Historial | PadelRise",
  description: "Tu recorrido ronda a ronda y movimientos en el torneo",
};

export default async function HistorialPage() {
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

  return <HistorialClient />;
}