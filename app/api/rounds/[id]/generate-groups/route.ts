// app/api/rounds/[id]/generate-groups/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildGroupsForRound } from "@/lib/rounds";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const round = await prisma.round.findUnique({
      where: { id: params.id },
      include: { tournament: true },
    });
    if (!round) {
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const strategy = (body?.strategy === "ranking" ? "ranking" : "random") as
      | "random"
      | "ranking";
    const groupSizeRaw = Number(body?.playersPerGroup);
    const groupSize =
      Number.isFinite(groupSizeRaw) && groupSizeRaw > 0 ? Math.trunc(groupSizeRaw) : undefined;

    // Llama al motor: ahora acepta (roundId, strategy, groupSize?)
    const result = await buildGroupsForRound(
      params.id,
      strategy,
      groupSize ?? undefined
    );

    const msg =
      result.groupCount > 0
        ? `Grupos generados: ${result.groupCount} x ${result.groupSize} (jugadores asignados: ${result.assigned}${
            result.skippedPlayerIds.length
              ? `; sin asignar: ${result.skippedPlayerIds.length}`
              : ""
          }).`
        : `No se pudieron crear grupos (jugadores insuficientes).`;

    return NextResponse.json({
      ok: true,
      message: msg,
      details: {
        roundId: params.id,
        strategy,
        groupSize: result.groupSize,
        groupCount: result.groupCount,
        assigned: result.assigned,
        skipped: result.skippedPlayerIds.length,
      },
    });
  } catch (err: any) {
    console.error("Error generate-groups:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error al generar grupos" },
      { status: 500 }
    );
  }
}
