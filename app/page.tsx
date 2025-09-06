// app/page.tsx - Nueva página de inicio con clasificaciones públicas
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PublicHome from "@/components/PublicHome";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    // Redirige a la vista correspondiente si ya hay sesión
    const isAdmin = (session.user as any)?.isAdmin;
    redirect(isAdmin ? "/admin/dashboard" : "/dashboard");
  }

  // Si NO hay sesión, mostramos la página pública con clasificaciones
  return <PublicHome />;
}