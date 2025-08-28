// types/nextauth.d.ts
import { DefaultSession } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      isAdmin: boolean;
      playerId?: string | null;
    };
  }

  interface User {
    id: string;
    isAdmin: boolean;
    playerId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    isAdmin?: boolean;
    playerId?: string | null;
  }
}

export {};
