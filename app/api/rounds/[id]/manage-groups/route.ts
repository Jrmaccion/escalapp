// app/api/rounds/[id]/manage-groups/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type GroupData = {
  groupId?: string;
  level: number;
  playerIds: string[];
};

type RequestBody = {
  groups: GroupData[];
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  console.log("🔧 manage-groups POST iniciado");
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      console.error("❌ No autorizado");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const roundId = params.id;
    console.log("🔧 Processing round:", roundId);

    let body: RequestBody;
    try {
      body = await req.json();
      console.log("🔧 Body received:", body);
    } catch (error) {
      console.error("❌ Error parsing JSON:", error);
      return NextResponse.json({ 
        error: "Formato de datos inválido",
        details: "No se pudo parsear el JSON"
      }, { status: 400 });
    }

    // Validar estructura básica
    if (!body || typeof body !== 'object') {
      console.error("❌ Body no es un objeto válido");
      return NextResponse.json({ 
        error: "Cuerpo de petición inválido" 
      }, { status: 400 });
    }

    if (!body.groups || !Array.isArray(body.groups)) {
      console.error("❌ groups no es un array:", body.groups);
      return NextResponse.json({ 
        error: "Se requiere un array 'groups'" 
      }, { status: 400 });
    }

    console.log("🔧 Groups count:", body.groups.length);

    // Verificar que la ronda existe y no está cerrada
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { id: true, isClosed: true, number: true }
    });

    if (!round) {
      console.error("❌ Ronda no encontrada:", roundId);
      return NextResponse.json({ 
        error: "Ronda no encontrada" 
      }, { status: 404 });
    }

    if (round.isClosed) {
      console.error("❌ Ronda cerrada:", roundId);
      return NextResponse.json({ 
        error: "No se puede modificar una ronda cerrada" 
      }, { status: 400 });
    }

    console.log("🔧 Round valid:", round.number);

    // Validar cada grupo
    for (let i = 0; i < body.groups.length; i++) {
      const group = body.groups[i];
      
      if (!group || typeof group !== 'object') {
        console.error(`❌ Grupo ${i + 1} no es un objeto válido:`, group);
        return NextResponse.json({ 
          error: `Grupo ${i + 1}: debe ser un objeto` 
        }, { status: 400 });
      }
      
      if (typeof group.level !== 'number' || group.level < 1) {
        console.error(`❌ Grupo ${i + 1} nivel inválido:`, group.level);
        return NextResponse.json({ 
          error: `Grupo ${i + 1}: nivel debe ser un número mayor a 0` 
        }, { status: 400 });
      }

      if (!Array.isArray(group.playerIds)) {
        console.error(`❌ Grupo ${i + 1} playerIds no es array:`, group.playerIds);
        return NextResponse.json({ 
          error: `Grupo ${i + 1}: playerIds debe ser un array` 
        }, { status: 400 });
      }

      // Solo validar jugadores si hay algunos asignados
      if (group.playerIds.length > 0) {
        // Verificar que todos los IDs son strings válidos
        for (const playerId of group.playerIds) {
          if (typeof playerId !== 'string' || !playerId.trim()) {
            console.error(`❌ Grupo ${i + 1} playerId inválido:`, playerId);
            return NextResponse.json({ 
              error: `Grupo ${i + 1}: playerIds debe contener IDs válidos` 
            }, { status: 400 });
          }
        }

        // Verificar que los jugadores existen
        const existingPlayers = await prisma.player.count({
          where: { id: { in: group.playerIds } }
        });
        
        if (existingPlayers !== group.playerIds.length) {
          console.error(`❌ Grupo ${i + 1} jugadores no existen:`, {
            expected: group.playerIds.length,
            found: existingPlayers,
            playerIds: group.playerIds
          });
          return NextResponse.json({ 
            error: `Grupo ${i + 1}: algunos jugadores no existen en la base de datos` 
          }, { status: 400 });
        }
      }
    }

    // Verificar jugadores duplicados
    const allPlayerIds = body.groups.flatMap(g => g.playerIds);
    const uniquePlayerIds = new Set(allPlayerIds);
    
    if (allPlayerIds.length !== uniquePlayerIds.size) {
      console.error("❌ Jugadores duplicados:", {
        total: allPlayerIds.length,
        unique: uniquePlayerIds.size
      });
      return NextResponse.json({ 
        error: "Un jugador no puede estar en múltiples grupos" 
      }, { status: 400 });
    }

    console.log("🔧 Validación completada, iniciando transacción");

    // Ejecutar transacción para reorganizar grupos
    const result = await prisma.$transaction(async (tx) => {
      console.log("🔧 Eliminando matches existentes");
      // 1. Eliminar partidos existentes
      const deletedMatches = await tx.match.deleteMany({
        where: { group: { roundId } }
      });

      console.log("🔧 Eliminando group players");
      // 2. Eliminar asignaciones de jugadores
      const deletedGroupPlayers = await tx.groupPlayer.deleteMany({
        where: { group: { roundId } }
      });

      console.log("🔧 Eliminando grupos");
      // 3. Eliminar grupos existentes
      const deletedGroups = await tx.group.deleteMany({
        where: { roundId }
      });

      console.log("🔧 Datos eliminados:", { 
        matches: deletedMatches.count, 
        groupPlayers: deletedGroupPlayers.count, 
        groups: deletedGroups.count 
      });

      let createdGroups = 0;
      let assignedPlayers = 0;

      // 4. Crear nuevos grupos (solo los que tienen jugadores)
      for (let i = 0; i < body.groups.length; i++) {
        const groupData = body.groups[i];
        
        if (groupData.playerIds.length > 0) {
          console.log(`🔧 Creando grupo ${i + 1} con ${groupData.playerIds.length} jugadores`);
          
          // Crear grupo
          const group = await tx.group.create({
            data: {
              roundId,
              number: createdGroups + 1, // Numeración secuencial solo de grupos con jugadores
              level: groupData.level
            }
          });

          // Asignar jugadores
          const groupPlayerInserts = groupData.playerIds.map((playerId, index) => ({
            groupId: group.id,
            playerId,
            position: index + 1,
            points: 0,
            streak: 0,
            usedComodin: false
          }));

          await tx.groupPlayer.createMany({
            data: groupPlayerInserts
          });

          createdGroups++;
          assignedPlayers += groupData.playerIds.length;
        }
      }

      return { createdGroups, assignedPlayers };
    });

    console.log("✅ Transacción completada:", result);

    return NextResponse.json({
      ok: true,
      message: `Grupos reorganizados correctamente: ${result.createdGroups} grupos con ${result.assignedPlayers} jugadores`,
      stats: {
        groupsCreated: result.createdGroups,
        playersAssigned: result.assignedPlayers
      }
    });

  } catch (error) {
    console.error("❌ Error en manage-groups:", error);
    return NextResponse.json({ 
      error: "Error interno del servidor",
      details: error instanceof Error ? error.message : "Error desconocido"
    }, { status: 500 });
  }
}