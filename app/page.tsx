// app/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import RegisterForm from "./auth/register/RegisterForm";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    // Redirige a la vista correspondiente si ya hay sesión
    const isAdmin = (session.user as any)?.isAdmin;
    redirect(isAdmin ? "/admin/dashboard" : "/dashboard");
  }

  // Si NO hay sesión, mostramos el formulario de registro directamente en inicio
  return <RegisterForm />;
}
