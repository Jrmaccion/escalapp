// lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" }, // encoding seguro en el browser
        adminKey: { label: "Clave Admin (opcional)", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email y contraseña son requeridos");
        }

        // Requisito mínimo de fuerza
        if (credentials.password.length < 8) {
          throw new Error("La contraseña debe tener al menos 8 caracteres");
        }

        // AdminKey fuerte y coincidente
        const adminKeyEnv = process.env.ADMIN_KEY;
        const isAdminLogin =
          Boolean(credentials.adminKey) &&
          Boolean(adminKeyEnv) &&
          credentials.adminKey === adminKeyEnv &&
          (adminKeyEnv?.length ?? 0) > 10;

        // Buscar usuario
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { player: true },
        });

        // Auto-creación de admin: sólo en desarrollo, estricto, y si aún no hay usuarios
        if (!user) {
          if (process.env.NODE_ENV === "development" && isAdminLogin) {
            const usersCount = await prisma.user.count();
            if (usersCount === 0) {
              const hashed = await bcrypt.hash(credentials.password, 12); // más rounds
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
          }
          throw new Error("Usuario no encontrado");
        }

        // Verificación de contraseña
        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) {
          throw new Error("Contraseña incorrecta");
        }

        // Solo admins existentes pueden usar adminKey (no eleva privilegios)
        if (isAdminLogin && !user.isAdmin) {
          throw new Error("No tienes permisos de administrador");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin, // NO elevamos con adminKey aquí
          playerId: user.player?.id ?? null,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24h
  },

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

  debug: false, // Nunca en producción
  useSecureCookies: process.env.NODE_ENV === "production",
};
