import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      isAdmin: boolean
      playerId?: string
    } & DefaultSession["user"]
  }

  interface User {
    isAdmin: boolean
    playerId?: string
  }
}
