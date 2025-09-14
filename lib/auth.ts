// lib/auth.ts - VERSIÓN CORREGIDA CON PLAYERID
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Faltan credenciales");
        }

        const email = credentials.email.trim().toLowerCase();

        // Busca por email e incluye información del jugador
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
            isAdmin: true,
            // ✅ INCLUIR DATOS DEL JUGADOR
            player: {
              select: {
                id: true,
                name: true,
              }
            }
          },
        });

        if (!user || !user.password) throw new Error("Credenciales inválidas");

        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) throw new Error("Credenciales inválidas");

        return {
          id: user.id,
          name: user.name ?? undefined,
          email: user.email ?? undefined,
          isAdmin: user.isAdmin === true,
          // ✅ INCLUIR PLAYERID EN EL OBJETO USER
          playerId: user.player?.id ?? null,
          playerName: user.player?.name ?? null,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
        token.isAdmin = (user as any).isAdmin === true;
        // ✅ AGREGAR PLAYERID AL TOKEN
        token.playerId = (user as any).playerId;
        token.playerName = (user as any).playerName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).uid;
        (session.user as any).isAdmin = (token as any).isAdmin === true;
        // ✅ AGREGAR PLAYERID A LA SESIÓN
        (session.user as any).playerId = (token as any).playerId;
        (session.user as any).playerName = (token as any).playerName;
      }
      return session;
    },
  },
  pages: {
    error: "/auth/error",
  },
};