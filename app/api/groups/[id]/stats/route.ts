import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGroupStats } from "@/lib/points-calculator";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groupId = params.id;
    if (!groupId) {
      return NextResponse.json({ error: "Group ID is required" }, { status: 400 });
    }

    const stats = await getGroupStats(groupId);

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("❌ Error fetching group stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch group stats" },
      { status: 500 }
    );
  }
}
