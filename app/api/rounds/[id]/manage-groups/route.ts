// app/api/rounds/[id]/manage-groups/route.ts
// Reorganización segura de grupos con detección de confirmados
// VERSIÓN MEJORADA CON VALIDACIONES

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GroupManager } from "@/lib/group-manager";

export const dynamic = "force-dynamic";

type GroupUpdatePayload = {
  groupId: string;
  players: Array<{ playerId: string }>;
};

type Body = {
  groups?: GroupUpdatePayload[];
  forceRegenerate?: boolean;
};

function readForceFlag(req: Request, bodyForce?: boolean): boolean {
  try {
    const url = new URL(req.url);
    const qsForce =
      url.searchParams.get("forceRegenerate") ??
      url.searchParams.get("force");

    const headerForce = req.headers.get("x-force-regenerate");

    return Boolean(
      bodyForce ||
        (qsForce !== null && ["1", "true", "yes"].includes(qsForce.toLowerCase())) ||
        (headerForce !== null && ["1", "true", "yes"].includes(headerForce.toLowerCase()))
    );
  } catch {
    return Boolean(bodyForce);
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log("🔧 [manage-groups] Iniciando...");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      console.log("❌ Usuario no autorizado");
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const roundId = decodeURIComponent(params.id);
    if (!roundId) {
      console.log("❌ Falta roundId");
      return NextResponse.json(
        { error: "Falta parámetro de ruta: roundId" },
        { status: 400 }
      );
    }

    console.log("📥 RoundId:", roundId);

    // Parsear body con validación
    let body: Body;
    try {
      const rawBody = await req.text();
      console.log("📦 Raw body:", rawBody);
      
      if (!rawBody) {
        body = { groups: [] };
      } else {
        body = JSON.parse(rawBody) as Body;
      }
    } catch (parseError) {
      console.error("❌ Error parseando JSON:", parseError);
      return NextResponse.json(
        { error: "JSON inválido en el body" },
        { status: 400 }
      );
    }

    console.log("📋 Body parseado:", {
      hasGroups: !!body.groups,
      groupsLength: body.groups?.length,
      forceRegenerate: body.forceRegenerate
    });

    // Validar que body.groups existe y es un array
    if (!body.groups) {
      console.log("❌ body.groups es undefined o null");
      return NextResponse.json(
        { error: "Falta el campo 'groups' en el body" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.groups)) {
      console.log("❌ body.groups no es un array:", typeof body.groups);
      return NextResponse.json(
        { error: "El campo 'groups' debe ser un array" },
        { status: 400 }
      );
    }

    if (body.groups.length === 0) {
      console.log("❌ Array de groups vacío");
      return NextResponse.json(
        { error: "Debe incluir al menos un grupo a actualizar" },
        { status: 400 }
      );
    }

    // Validar estructura de cada grupo
    for (let i = 0; i < body.groups.length; i++) {
      const group = body.groups[i];
      if (!group.groupId) {
        console.log(`❌ Grupo ${i} sin groupId:`, group);
        return NextResponse.json(
          { error: `El grupo en posición ${i} no tiene groupId` },
          { status: 400 }
        );
      }
      if (!Array.isArray(group.players)) {
        console.log(`❌ Grupo ${i} sin array de players:`, group);
        return NextResponse.json(
          { error: `El grupo ${group.groupId} no tiene un array válido de players` },
          { status: 400 }
        );
      }
    }

    const forceRegenerate = readForceFlag(req, body.forceRegenerate);
    console.log("🔄 Force regenerate:", forceRegenerate);

    // 1) Validar ronda
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, number: true, isClosed: true },
    });
    
    if (!round) {
      console.log("❌ Ronda no encontrada:", roundId);
      return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
    }
    
    if (round.isClosed) {
      console.log("❌ Ronda cerrada");
      return NextResponse.json({ error: "La ronda está cerrada" }, { status: 409 });
    }

    console.log("✅ Ronda válida:", round);

    // 2) Validar que los grupos pertenecen a la ronda
    const requestedGroupIds = body.groups.map((g) => g.groupId);
    console.log("🔍 Grupos solicitados:", requestedGroupIds);

    const groupsInRound = await prisma.group.findMany({
      where: { roundId, id: { in: requestedGroupIds } },
      select: { id: true, number: true },
    });

    console.log("📊 Grupos encontrados en ronda:", groupsInRound.length);

    const notInRound = requestedGroupIds.filter(
      (gid) => !groupsInRound.some((g) => g.id === gid)
    );
    
    if (notInRound.length > 0) {
      console.log("❌ Grupos no pertenecen a la ronda:", notInRound);
      return NextResponse.json(
        { error: "Algunos grupos no pertenecen a la ronda", details: { notInRound } },
        { status: 400 }
      );
    }

    // 3) Bloquear si hay PARTIDOS CONFIRMADOS en la ronda (inmutable)
    const confirmedMatches = await prisma.match.count({
      where: { group: { roundId }, isConfirmed: true },
    });
    
    if (confirmedMatches > 0) {
      console.log("❌ Hay partidos confirmados:", confirmedMatches);
      return NextResponse.json(
        {
          error: "No se puede regenerar grupos: existen partidos ya confirmados en esta ronda.",
          details: { 
            confirmedMatches, 
            suggestion: "Solo las rondas sin resultados confirmados pueden reorganizarse." 
          },
        },
        { status: 400 }
      );
    }

    // 4) Detectar grupos con partidos generados (no confirmados)
    const groupsWithMatches = await prisma.match.findMany({
      where: { groupId: { in: requestedGroupIds } },
      select: { groupId: true },
      distinct: ["groupId"],
    });
    
    const groupIdsWithMatches = new Set(groupsWithMatches.map((m) => m.groupId));
    console.log("⚠️ Grupos con partidos generados:", groupIdsWithMatches.size);

    if (groupIdsWithMatches.size > 0 && !forceRegenerate) {
      console.log("⛔ Se requiere forceRegenerate");
      return NextResponse.json(
        {
          error: "Ya existen partidos generados en algunos grupos. Usa forceRegenerate=true para regenerarlos.",
          details: { groupIds: Array.from(groupIdsWithMatches) },
        },
        { status: 400 }
      );
    }

    console.log("🚀 Iniciando transacción...");

    // 5) Transacción principal
    const result = await prisma.$transaction(async (tx) => {
      // 5.a) Si hay que regenerar, borra partidos existentes de los grupos objetivo
      if (groupIdsWithMatches.size > 0 && forceRegenerate) {
        console.log("🗑️ Eliminando partidos existentes...");
        const deleted = await tx.match.deleteMany({
          where: { groupId: { in: requestedGroupIds } },
        });
        console.log(`✅ Eliminados ${deleted.count} partidos`);
      }

      // 5.b) Reasignación segura por grupo (offset temporal de posiciones)
      for (const payload of body.groups!) {
        const { groupId, players } = payload;
        console.log(`🔄 Procesando grupo ${groupId} con ${players.length} jugadores`);

        // eliminar los que ya no están
        const current = await tx.groupPlayer.findMany({
          where: { groupId },
          select: { id: true, playerId: true },
        });
        
        const requestedIds = players.map((p) => p.playerId);
        const toRemove = current.filter((c) => !requestedIds.includes(c.playerId));
        
        if (toRemove.length > 0) {
          console.log(`  ➖ Eliminando ${toRemove.length} jugadores del grupo`);
          await tx.groupPlayer.deleteMany({
            where: { id: { in: toRemove.map((r) => r.id) } },
          });
        }

        // offset temporal para TODOS los supervivientes
        const survivors = await tx.groupPlayer.findMany({
          where: { groupId },
          select: { id: true },
        });
        
        if (survivors.length > 0) {
          console.log(`  🔢 Aplicando offset temporal a ${survivors.length} supervivientes`);
          await tx.groupPlayer.updateMany({
            where: { id: { in: survivors.map((s) => s.id) } },
            data: { position: { increment: 100 } },
          });
        }

        // upserts orden final 1..N
        console.log(`  ✏️ Actualizando posiciones finales...`);
        for (let i = 0; i < players.length; i++) {
          const playerId = players[i].playerId;
          await tx.groupPlayer.upsert({
            where: { groupId_playerId: { groupId, playerId } },
            update: { position: i + 1 },
            create: { groupId, playerId, position: i + 1 },
          });
        }

        // 5.c) Regenerar 3 sets del grupo si procede
        if (forceRegenerate) {
          console.log(`  🎯 Generando partidos para grupo ${groupId}...`);
          await GroupManager.generateMatchesForGroup(tx, groupId);
        }
      }

      // 5.d) Devolver estado refrescado
      console.log("📤 Obteniendo estado refrescado...");
      const refreshed = await tx.group.findMany({
        where: { id: { in: requestedGroupIds } },
        include: {
          players: {
            select: {
              playerId: true,
              position: true,
              points: true,
              streak: true,
              usedComodin: true,
              locked: true,
            },
            orderBy: { position: "asc" },
          },
          matches: { select: { id: true, isConfirmed: true } },
        },
        orderBy: { number: "asc" },
      });

      console.log(`✅ Transacción completada. ${refreshed.length} grupos actualizados`);

      return {
        ok: true,
        message: "Grupos actualizados correctamente",
        regenerated: forceRegenerate,
        groups: refreshed,
      };
    });

    console.log("🎉 Proceso completado exitosamente");
    return NextResponse.json(result);
    
  } catch (err: any) {
    console.error("[POST /api/rounds/[id]/manage-groups] Error:", err);
    console.error("Stack:", err.stack);
    
    const msg = typeof err?.message === "string" ? err.message : "Error interno del servidor";
    const status = msg.toLowerCase().includes("unique") ? 409 : 500;
    
    return NextResponse.json({ 
      error: msg,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status });
  }
}