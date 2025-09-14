import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import ResetPasswordForm from "./ResetPasswordForm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function AdminUserPage({ params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/auth/login");
  }
  
  if (!(session.user as any)?.isAdmin) {
    redirect("/dashboard");
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, name: true, isAdmin: true },
  });

  if (!user) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a usuarios
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Gestionar Usuario</h1>
          <p className="text-gray-600">{user.name || "Sin nombre"} — {user.email}</p>
          {user.isAdmin && (
            <span className="inline-block mt-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
              Administrador
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold mb-3">Cambiar contraseña</h2>
        <ResetPasswordForm userId={user.id} userEmail={user.email} />
      </div>
    </div>
  );
}