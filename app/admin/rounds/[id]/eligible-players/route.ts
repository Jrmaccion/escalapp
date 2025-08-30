import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // 307 para preservar el método GET
  const url = new URL(`/api/rounds/${params.id}/eligible-players`, req.url);
  return NextResponse.redirect(url, 307);
}
