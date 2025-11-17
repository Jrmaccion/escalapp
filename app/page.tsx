// app/page.tsx - Home pública / redirección a dashboard
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PublicHome from "@/components/PublicHome";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    // Redirigir a /dashboard siempre (maneja lógica de admin allí)
    redirect("/dashboard");
  }

  // Página pública
  return <PublicHome />;
}
