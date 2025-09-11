// app/historial/page.tsx - REEMPLAZAR por:
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
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

  return <HistorialClient />;
}