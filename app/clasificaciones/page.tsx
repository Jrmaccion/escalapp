// app/clasificaciones/page.tsx - REEMPLAZAR completamente:
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ClasificacionesClient from "./ClasificacionesClient";

export const metadata = {
  title: "Clasificaciones | Escalapp",
  description: "Rankings oficial e ironman del torneo",
};

export default async function ClasificacionesPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/login");
  }

  return <ClasificacionesClient />;
}