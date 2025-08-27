import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
        adminKey: { label: "Clave Admin (opcional)", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email y contraseña son requeridos")
        }

        const isAdminLogin = credentials.adminKey === process.env.ADMIN_KEY

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { player: true }
        })

        if (!user) {
          throw new Error("Usuario no encontrado")
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.password)
        if (!isValidPassword) {
          throw new Error("Contraseña incorrecta")
        }

        if (isAdminLogin && !user.isAdmin) {
          throw new Error("No tienes permisos de administrador")
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin || isAdminLogin,
          playerId: user.player?.id
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.isAdmin = user.isAdmin
        token.playerId = user.playerId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.isAdmin = token.isAdmin as boolean
        session.user.playerId = token.playerId as string
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error"
  }
}
