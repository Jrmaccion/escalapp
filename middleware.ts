// /middleware.ts
import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

// Matcher según lo que necesites
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
