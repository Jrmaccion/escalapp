// lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  // Configuración correcta para producción
  secret: process.env.NEXTAUTH_SECRET,
  
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
        adminKey: { label: "Clave Admin (opcional)", type: "password" },
      },
      async authorize(credentials) {
        // ... tu código existente permanece igual
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email y contraseña son requeridos");
        }

        const isAdminLogin = credentials.adminKey === process.env.ADMIN_KEY;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { player: true },
        });

        if (!user) {
          const usersCount = await prisma.user.count();
          if (usersCount === 0 && isAdminLogin) {
            const hashed = await bcrypt.hash(credentials.password, 10);
            const newAdmin = await prisma.user.create({
              data: {
                name: "Administrador",
                email: credentials.email,
                password: hashed,
                isAdmin: true,
              },
            });
            return {
              id: newAdmin.id,
              name: newAdmin.name,
              email: newAdmin.email,
              isAdmin: true,
              playerId: null,
            };
          }
          throw new Error("Usuario no encontrado");
        }

        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) throw new Error("Contraseña incorrecta");

        if (isAdminLogin && !user.isAdmin) {
          throw new Error("No tienes permisos de administrador");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin || isAdminLogin,
          playerId: user.player?.id ?? null,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.isAdmin = (user as any).isAdmin;
        token.playerId = (user as any).playerId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.isAdmin = Boolean((token as any).isAdmin);
        session.user.playerId = (token as any).playerId ?? null;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
};