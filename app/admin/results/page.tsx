import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import AdminResultsClient from "./AdminResultsClient";

export const metadata: Metadata = {
  title: "Gestión de Resultados | PadelRise",
  description: "Gestionar, validar y corregir todos los resultados del sistema",
};

export default async function AdminResultsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (!session.user?.isAdmin) redirect("/dashboard");

  return <AdminResultsClient />;
}