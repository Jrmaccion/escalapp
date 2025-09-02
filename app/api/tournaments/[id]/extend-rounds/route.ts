// app/api/tournaments/route.ts - VERSIÓN CORREGIDA
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";
import { buildGroupsForFirstRound, GROUP_SIZE } from "@/lib/rounds";
import { generateRotationForGroup } from "@/lib/matches";

export async function GET() {
  try {
    const tournaments = await prisma.tournament.findMany({
      include: {
        rounds: { select: { id: true, number: true, isClosed: true } },
        players: { include: { player: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tournaments);
  } catch (error) {
    console.error("Error fetching tournaments:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      startDate,
      totalRounds,
      roundDurationDays,
      isPublic,
      selectedPlayerIds,
    } = body as {
      title: string;
      startDate: string;
      totalRounds: number;
      roundDurationDays: number;
      isPublic: boolean;
      selectedPlayerIds?: string[];
    };

    // ✅ VALIDACIONES MEJORADAS
    if (!title?.trim() || !startDate || !totalRounds || !roundDurationDays) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }
    
    if (totalRounds < 3 || totalRounds > 20) {
      return NextResponse.json(
        { error: "Las rondas deben estar entre 3 y 20" },
        { status: 400 }
      );
    }
    
    if (roundDurationDays < 7 || roundDurationDays > 30) {
      return NextResponse.json(
        { error: "Los días por ronda deben estar entre 7 y 30" },
        { status: 400 }
      );
    }
    
    if (new Date(startDate) <= new Date()) {
      return NextResponse.json(
        { error: "La fecha de inicio debe ser futura" },
        { status: 400 }
      );
    }

    // ✅ VERIFICAR JUGADORES EXISTEN (ESTO FALTABA)
    let validPlayerIds: string[] = [];
    if (Array.isArray(selectedPlayerIds) && selectedPlayerIds.length > 0) {
      const uniqueIds = Array.from(new Set(selectedPlayerIds.filter(Boolean)));
      
      // Verificar que todos los jugadores existen
      const existingPlayers = await prisma.player.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, name: true }
      });
      
      validPlayerIds = existingPlayers.map(p => p.id);
      
      // Log de jugadores no encontrados para debug
      const notFound = uniqueIds.filter(id => !validPlayerIds.includes(id));
      if (notFound.length > 0) {
        console.warn(`Jugadores no encontrados en creación de torneo: ${notFound.join(', ')}`);
      }

      // ✅ VALIDAR MÚLTIPLOS DE 4 PARA GRUPOS
      if (validPlayerIds.length > 0 && validPlayerIds.length % GROUP_SIZE !== 0) {
        return NextResponse.json({
          error: `Para crear grupos automáticamente necesitas un múltiplo de ${GROUP_SIZE} jugadores. Tienes ${validPlayerIds.length} válidos de ${uniqueIds.length} enviados.`,
          details: {
            valid: validPlayerIds.length,
            sent: uniqueIds.length,
            notFound: notFound.length > 0 ? notFound : undefined
          }
        }, { status: 400 });
      }
    }

    // Verificar nombre único
    const existingTournament = await prisma.tournament.findFirst({
      where: { title: title.trim() },
    });
    if (existingTournament) {
      return NextResponse.json(
        { error: "Ya existe un torneo con ese nombre" },
        { status: 400 }
      );
    }

    // ✅ TRANSACCIÓN COMPLETA PARA EVITAR ESTADOS INCONSISTENTES
    const result = await prisma.$transaction(async (tx) => {
      // 1) Crear torneo
      const start = new Date(startDate);
      const end = addDays(start, totalRounds * roundDurationDays);

      const tournament = await tx.tournament.create({
        data: {
          title: title.trim(),
          startDate: start,
          endDate: end,
          totalRounds: Number(totalRounds),
          roundDurationDays: Number(roundDurationDays),
          isActive: true,
          isPublic: Boolean(isPublic),
        },
      });

      // 2) Crear todas las rondas
      const roundsToCreate = [];
      let currentStartDate = new Date(start);
      
      for (let i = 1; i <= totalRounds; i++) {
        const roundEndDate = addDays(currentStartDate, roundDurationDays);
        roundsToCreate.push({
          tournamentId: tournament.id,
          number: i,
          startDate: currentStartDate,
          endDate: roundEndDate,
          isClosed: false,
        });
        currentStartDate = new Date(roundEndDate);
      }

      await tx.round.createMany({ data: roundsToCreate });

      // 3) ✅ INSCRIBIR JUGADORES VALIDADOS
      let inscribedCount = 0;
      let r1Id: string | null = null;

      if (validPlayerIds.length > 0) {
        // Inscribir jugadores
        const playerInserts = validPlayerIds.map(playerId => ({
          tournamentId: tournament.id,
          playerId,
          joinedRound: 1,
          comodinesUsed: 0,
        }));

        await tx.tournamentPlayer.createMany({ data: playerInserts });
        inscribedCount = validPlayerIds.length;

        // 4) ✅ CREAR R1 CON GRUPOS Y PARTIDOS
        const r1 = await tx.round.findFirst({
          where: { tournamentId: tournament.id, number: 1 },
        });

        if (r1) {
          r1Id = r1.id;

          // Construir grupos de exactamente 4 jugadores
          const eligiblePlayers = validPlayerIds.map((id, index) => ({
            playerId: id,
            name: `Player_${index}` // Nombre temporal, se calculará después
          }));

          const groupsData = buildGroupsForFirstRound(eligiblePlayers, GROUP_SIZE);

          // Crear grupos
          for (const groupData of groupsData) {
            const group = await tx.group.create({
              data: {
                roundId: r1.id,
                number: groupData.number,
                level: groupData.level ?? 0,
              },
            });

            // Crear jugadores del grupo
            const groupPlayerInserts = groupData.players.map(p => ({
              groupId: group.id,
              playerId: p.playerId,
              position: p.position,
              points: 0,
              streak: 0,
              usedComodin: false,
            }));

            await tx.groupPlayer.createMany({ data: groupPlayerInserts });

            // ✅ GENERAR PARTIDOS AUTOMÁTICAMENTE
            if (groupData.players.length === GROUP_SIZE) {
              // Crear los 3 sets del sistema de rotación
              const matches = [
                { // Set 1
                  groupId: group.id,
                  setNumber: 1,
                  team1Player1Id: groupData.players[0].playerId,
                  team1Player2Id: groupData.players[3].playerId,
                  team2Player1Id: groupData.players[1].playerId,
                  team2Player2Id: groupData.players[2].playerId,
                },
                { // Set 2
                  groupId: group.id,
                  setNumber: 2,
                  team1Player1Id: groupData.players[0].playerId,
                  team1Player2Id: groupData.players[1].playerId,
                  team2Player1Id: groupData.players[2].playerId,
                  team2Player2Id: groupData.players[3].playerId,
                },
                { // Set 3
                  groupId: group.id,
                  setNumber: 3,
                  team1Player1Id: groupData.players[0].playerId,
                  team1Player2Id: groupData.players[2].playerId,
                  team2Player1Id: groupData.players[1].playerId,
                  team2Player2Id: groupData.players[3].playerId,
                }
              ];

              await tx.match.createMany({ data: matches });
            }
          }
        }
      }

      return {
        tournament,
        inscribedCount,
        r1Id,
        groupsCreated: validPlayerIds.length > 0 ? Math.floor(validPlayerIds.length / GROUP_SIZE) : 0
      };
    });

    // ✅ RESPUESTA DETALLADA PARA DEBUG
    return NextResponse.json({
      id: result.tournament.id,
      success: true,
      details: {
        tournament: {
          id: result.tournament.id,
          title: result.tournament.title,
        },
        players: {
          requested: selectedPlayerIds?.length || 0,
          inscribed: result.inscribedCount,
        },
        r1: {
          created: !!result.r1Id,
          id: result.r1Id,
          groups: result.groupsCreated,
          matches: result.groupsCreated * 3 // 3 sets por grupo
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating tournament:", error);
    return NextResponse.json(
      { 
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}