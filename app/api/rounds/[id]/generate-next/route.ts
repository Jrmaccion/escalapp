// app/api/rounds/[id]/generate-next/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateNextRoundFromMovements } from "@/lib/rounds";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    const nextRoundId = await generateNextRoundFromMovements(params.id);
    return NextResponse.json({ ok: true, nextRoundId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error generando siguiente ronda" }, { status: 400 });
  }
}
