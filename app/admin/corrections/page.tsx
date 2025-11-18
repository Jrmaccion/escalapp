import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import CorrectionsClient from "./CorrectionsClient";

export const metadata = {
  title: "Corrección de Rondas | Admin",
  description: "Herramienta administrativa para corregir rondas cerradas",
};

export default async function CorrectionsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isAdmin) {
    redirect("/dashboard");
  }

  return <CorrectionsClient />;
}
