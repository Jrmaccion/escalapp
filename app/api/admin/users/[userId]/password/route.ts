// app/api/admin/users/[userId]/password/route.ts - CORREGIDO
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    console.log("🔧 PATCH password API - userId:", params.userId);
    
    // Verificar sesión y permisos de administrador
    const session = await getServerSession(authOptions);
    console.log("👤 API Session:", session?.user?.email, "isAdmin:", (session?.user as any)?.isAdmin);
    
    // CORREGIDO: Misma verificación que en la página
    if (!session?.user) {
      console.log("❌ API: No session.user");
      return NextResponse.json(
        { error: "No autorizado - sin sesión" }, 
        { status: 403 }
      );
    }
    
    const isAdmin = !!(session.user as any)?.isAdmin;
    console.log("🔐 API isAdmin check:", isAdmin);
    
    if (!isAdmin) {
      console.log("❌ API: Not admin");
      return NextResponse.json(
        { error: "No autorizado - no es admin" }, 
        { status: 403 }
      );
    }

    // Validar parámetros
    const userId = params.userId;
    if (!userId) {
      return NextResponse.json(
        { error: "Falta userId" }, 
        { status: 400 }
      );
    }

    // Extraer y validar nueva contraseña
    const { newPassword } = await req.json();
    console.log("🔑 API: Changing password for userId:", userId);

    // Validaciones consistentes con register
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { error: "La contraseña debe incluir letras y números" },
        { status: 400 }
      );
    }

    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" }, 
        { status: 404 }
      );
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Actualizar contraseña en base de datos
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Log para auditoría
    console.log(`✅ Password reset for user ${user.email} by admin ${session.user.email}`);

    return NextResponse.json({ 
      ok: true,
      message: "Contraseña actualizada correctamente"
    });

  } catch (error) {
    console.error("❌ PATCH /api/admin/users/[userId]/password error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" }, 
      { status: 500 }
    );
  }
}