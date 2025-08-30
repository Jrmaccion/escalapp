// app/api/rounds/[id]/generate-groups/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildGroupsForRound } from "@/lib/rounds";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { strategy = "ranking", playersPerGroup = 4, force = false } = await req.json();

    if (force) {
      // buildGroupsForRound ya elimina grupos del round y los recrea
      await buildGroupsForRound(params.id, strategy, playersPerGroup);
    } else {
      await buildGroupsForRound(params.id, strategy, playersPerGroup);
    }

    return NextResponse.json({ message: "Grupos generados correctamente" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error generando grupos" }, { status: 400 });
  }
}
