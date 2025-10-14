// app/mi-grupo/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MiGrupoClient from "./MiGrupoClient";

export const metadata = {
  title: "Mi Grupo | Escalapp",
  description: "Información de tu grupo actual y próximos partidos",
};

export default async function MiGrupoPage() {
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

  return <MiGrupoClient />;
}