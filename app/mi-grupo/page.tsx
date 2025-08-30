// app/mi-grupo/page.tsx - REEMPLAZAR el contenido por:
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
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

  return <MiGrupoClient />;
}