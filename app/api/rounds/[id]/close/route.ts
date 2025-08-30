// app/api/rounds/[id]/close/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { closeRound } from "@/lib/rounds";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    await closeRound(params.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error cerrando ronda" }, { status: 400 });
  }
}
