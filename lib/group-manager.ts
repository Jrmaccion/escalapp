// lib/group-manager.ts
// Gestor centralizado de grupos para rondas (creación, reorganización y movimientos de escalera)

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ===========================
// Tipos públicos
// ===========================

export type GroupPlayerInput = {
  playerId: string;
  position?: number; // si no viene, se asigna por orden
};

export type GroupInput = {
  // Si estás reorganizando grupos existentes, puedes incluir "groupId" (opcional)
  groupId?: string;
  level?: number | null;
  // Si usas "number" en tu schema para el índice visible de grupo, lo derivamos del orden si no llega
  number?: number;
  players: GroupPlayerInput[];
};

export type UpdateRoundGroupsOptions = {
  deleteExisting?: boolean;    // elimina grupos/partidos anteriores de la ronda
  generateMatches?: boolean;   // genera automáticamente los 3 sets por grupo
  validateIntegrity?: boolean; // valida duplicados/posiciones
};

export type UpdateRoundGroupsResult = {
  success: boolean;
  groupsCreated: number;
  playersAssigned: number;
  message?: string;
};

export type ReorganizeGroupsResult = {
  success: boolean;
  groupsUpdated: number;
  playersAssigned: number;
  message?: string;
};

export type ApplyMovementsInput = {
  playerId: string;
  targetGroupLevel: number;  // destino por "nivel" (1..N)
  targetPosition?: number;   // si no llega, se apila al final
};

export class GroupManager {
  // ===========================
  // API pública
  // ===========================

  static async updateRoundGroups(
    roundId: string,
    groupsData: GroupInput[],
    opts: UpdateRoundGroupsOptions = { deleteExisting: false, generateMatches: false, validateIntegrity: true }
  ): Promise<UpdateRoundGroupsResult> {
    // Validación básica
    if (!Array.isArray(groupsData) || groupsData.length === 0) {
      throw new Error("No se han proporcionado grupos para crear.");
    }

    if (opts.validateIntegrity) {
      this.ensureNoDuplicatePlayersAcrossGroups(groupsData);
      this.ensureNoDuplicatePositionsWithinGroups(groupsData);
    }

    // Transacción principal
    const result = await prisma.$transaction(async (tx) => {
      // 1) Validar ronda
      const round = await tx.round.findUnique({
        where: { id: roundId },
        include: { groups: { include: { players: true, matches: true } } },
      });
      if (!round) throw new Error("Ronda no encontrada.");
      if (round.isClosed) throw new Error("La ronda está cerrada y no se puede modificar.");

      // 2) Opcionalmente eliminar datos previos
      if (opts.deleteExisting) {
        await this._deleteRoundGroupsAndMatches(tx, roundId);
      }

      // 3) Crear nuevos grupos + players
      let playersAssigned = 0;

      const createdGroups: { id: string; number: number }[] = [];
      for (let i = 0; i < groupsData.length; i++) {
        const g = groupsData[i];
        const groupNumber = g.number ?? i + 1;

        const group = await tx.group.create({
          data: {
            roundId,
            number: groupNumber,
            level: g.level ?? groupNumber, // fallback sensato
          },
        });
        createdGroups.push({ id: group.id, number: groupNumber });

        // Insertar jugadores con posición (o por orden)
        for (let j = 0; j < g.players.length; j++) {
          const gp = g.players[j];
          await tx.groupPlayer.create({
            data: {
              groupId: group.id,
              playerId: gp.playerId,
              position: gp.position ?? j + 1,
            },
          });
          playersAssigned += 1;
        }
      }

      // 4) Generar partidos si se ha pedido
      if (opts.generateMatches) {
        for (const g of createdGroups) {
          await this._generateMatchesForGroup(tx, g.id);
        }
      }

      return {
        success: true,
        groupsCreated: groupsData.length,
        playersAssigned,
      } as UpdateRoundGroupsResult;
    });

    return result;
  }

  static async reorganizeGroups(
    roundId: string,
    groups: Array<{ groupId?: string; level?: number | null; playerIds: string[] }>
  ): Promise<ReorganizeGroupsResult> {
    if (!Array.isArray(groups)) {
      throw new Error("Payload inválido: 'groups' debe ser un array.");
    }

    // Transformar a GroupInput para validar integridad
    const groupsData: GroupInput[] = groups.map((g, idx) => ({
      groupId: g.groupId,
      level: g.level ?? idx + 1,
      number: idx + 1,
      players: g.playerIds.map((pid, pIdx) => ({ playerId: pid, position: pIdx + 1 })),
    }));

    // Validaciones
    this.ensureNoDuplicatePlayersAcrossGroups(groupsData);
    this.ensureNoDuplicatePositionsWithinGroups(groupsData);

    // Reorganización transaccional
    const result = await prisma.$transaction(async (tx) => {
      // 1) Validar ronda
      const round = await tx.round.findUnique({
        where: { id: roundId },
        include: {
          groups: {
            include: {
              players: true,
              matches: true,
            },
          },
        },
      });
      if (!round) throw new Error("Ronda no encontrada.");
      if (round.isClosed) throw new Error("La ronda está cerrada y no se puede modificar.");

      let playersAssigned = 0;
      let groupsUpdated = 0;

      // Mapa de grupos existentes por id para búsquedas rápidas
      const existingById = new Map(round.groups.map((g) => [g.id, g]));

      for (let i = 0; i < groupsData.length; i++) {
        const g = groupsData[i];
        const number = g.number ?? i + 1;

        // a) Resolver groupId → crear si no existe
        let groupId = g.groupId;
        if (groupId && !existingById.has(groupId)) {
          // Si llega un id inexistente, lo ignoramos y creamos
          groupId = undefined;
        }

        if (!groupId) {
          const created = await tx.group.create({
            data: {
              roundId,
              number,
              level: g.level ?? number,
            },
          });
          groupId = created.id;
          existingById.set(groupId, { ...created, players: [], matches: [] } as any);
        } else {
          // Actualiza level/number si han cambiado
          await tx.group.update({
            where: { id: groupId },
            data: { level: g.level ?? number, number },
          });
        }

        // b) Borrar partidos del grupo (cambió la composición)
        await tx.match.deleteMany({ where: { groupId } });

        // c) Sincronizar jugadores del grupo:
        //    - eliminar los que ya no están
        //    - upsert/crear los nuevos con posición correcta
        const incomingIds = new Set(g.players.map((p) => p.playerId));

        await tx.groupPlayer.deleteMany({
          where: {
            groupId,
            playerId: { notIn: Array.from(incomingIds) },
          },
        });

        for (const p of g.players) {
          await tx.groupPlayer.upsert({
            where: {
              // Ajusta a tu unique compuesto real si difiere:
              groupId_playerId: { groupId, playerId: p.playerId },
            },
            update: { position: p.position ?? 0 },
            create: {
              groupId,
              playerId: p.playerId,
              position: p.position ?? 0,
            },
          });
          playersAssigned += 1;
        }

        groupsUpdated += 1;
      }

      return {
        success: true,
        groupsUpdated,
        playersAssigned,
        message: "Grupos reorganizados correctamente. Los partidos existentes de los grupos modificados han sido eliminados.",
      } as ReorganizeGroupsResult;
    });

    return result;
  }

  /**
   * Aplica movimientos de escalera entre rondas:
   * - fromRoundId: ronda origen (para referencia si hace falta)
   * - toRoundId: ronda destino ya creada (sin partidos o con partidos que serán regenerados después)
   * - movements: lista de (playerId, targetGroupLevel, targetPosition?)
   */
  static async applyLadderMovements(
    fromRoundId: string,
    toRoundId: string,
    movements: ApplyMovementsInput[]
  ): Promise<{ success: boolean; message: string }> {
    if (!Array.isArray(movements) || movements.length === 0) {
      return { success: true, message: "No hay movimientos a aplicar." };
    }

    await prisma.$transaction(async (tx) => {
      // 1) Cargar grupos destino por nivel
      const destGroups = await tx.group.findMany({
        where: { roundId: toRoundId },
        orderBy: [{ level: "asc" }, { number: "asc" }],
        include: { players: true },
      });

      if (destGroups.length === 0) {
        throw new Error("La ronda destino no tiene grupos creados.");
      }

      const groupsByLevel = new Map<number, (typeof destGroups)[number]>();
      for (const g of destGroups) {
        const lvl = (g as any).level ?? (g as any).number;
        groupsByLevel.set(lvl, g);
      }

      // 2) Aplicar movimientos (con saturación a bordes si el nivel target no existe)
      const min = Math.min(...Array.from(groupsByLevel.keys()));
      const max = Math.max(...Array.from(groupsByLevel.keys()));

      for (const mv of movements) {
        const clampedLevel = Math.max(min, Math.min(max, mv.targetGroupLevel));
        const target = groupsByLevel.get(clampedLevel);
        if (!target) continue;

        await this._placePlayerInGroup(tx, target.id, mv.playerId, mv.targetPosition);
      }

      // 3) Tras colocar, normalizar posiciones por grupo (1..N)
      for (const g of destGroups) {
        const players = await tx.groupPlayer.findMany({
          where: { groupId: g.id },
          orderBy: [{ position: "asc" }, { playerId: "asc" }],
          select: { playerId: true, position: true },
        });

        for (let i = 0; i < players.length; i++) {
          const p = players[i];
          await tx.groupPlayer.update({
            where: { groupId_playerId: { groupId: g.id, playerId: p.playerId } },
            data: { position: i + 1 },
          });
        }
      }

      // 4) Eliminar partidos preexistentes de la ronda destino (si los hubiera)
      await tx.match.deleteMany({ where: { group: { roundId: toRoundId } } });
    });

    return { success: true, message: "Movimientos aplicados y posiciones normalizadas." };
  }

  // ===========================
  // Helpers internos
  // ===========================

  private static ensureNoDuplicatePlayersAcrossGroups(groups: GroupInput[]) {
    const seen = new Set<string>();
    for (const g of groups) {
      for (const p of g.players) {
        if (seen.has(p.playerId)) {
          throw new Error(`Integridad: el jugador ${p.playerId} aparece en más de un grupo.`);
        }
        seen.add(p.playerId);
      }
    }
  }

  private static ensureNoDuplicatePositionsWithinGroups(groups: GroupInput[]) {
    for (const [idx, g] of groups.entries()) {
      const positions = new Set<number>();
      for (let i = 0; i < g.players.length; i++) {
        const pos = g.players[i].position ?? i + 1;
        if (positions.has(pos)) {
          throw new Error(`Integridad: posiciones duplicadas en el grupo #${idx + 1} (posición ${pos}).`);
        }
        positions.add(pos);
      }
    }
  }

  private static async _deleteRoundGroupsAndMatches(tx: Prisma.TransactionClient, roundId: string) {
    // Borrar partidos de todos los grupos de la ronda
    await tx.match.deleteMany({
      where: { group: { roundId } },
    });

    // Borrar jugadores de grupo
    await tx.groupPlayer.deleteMany({
      where: { group: { roundId } },
    });

    // Borrar grupos
    await tx.group.deleteMany({
      where: { roundId },
    });
  }

  private static async _placePlayerInGroup(
    tx: Prisma.TransactionClient,
    groupId: string,
    playerId: string,
    targetPosition?: number
  ) {
    // Si el jugador ya estaba en ese grupo, solo actualizamos posición (muy alta para normalizar luego si no se pasa target)
    const exists = await tx.groupPlayer.findUnique({
      where: { groupId_playerId: { groupId, playerId } },
      select: { groupId: true, playerId: true },
    });

    if (exists) {
      await tx.groupPlayer.update({
        where: { groupId_playerId: { groupId, playerId } },
        data: { position: targetPosition ?? 9999 },
      });
      return;
    }

    // Calcular posición final si no se pasó
    let position = targetPosition;
    if (!position) {
      const count = await tx.groupPlayer.count({ where: { groupId } });
      position = count + 1;
    }

    await tx.groupPlayer.create({
      data: { groupId, playerId, position },
    });
  }

  /**
   * Genera los 3 sets de un grupo siguiendo la rotación fija del proyecto:
   * Set 1 → 1+4 vs 2+3
   * Set 2 → 1+3 vs 2+4
   * Set 3 → 1+2 vs 3+4
   * Si hay menos de 4 jugadores, genera los que sean viables.
   */
  private static async _generateMatchesForGroup(
    tx: Prisma.TransactionClient,
    groupId: string
  ) {
    const players = await tx.groupPlayer.findMany({
      where: { groupId },
      orderBy: { position: "asc" },
      select: { playerId: true, position: true },
    });

    if (players.length < 2) return;

    const pid = (pos: number) => players.find(p => p.position === pos)?.playerId;

    const sets = [
      { setNumber: 1, team1: [pid(1), pid(4)], team2: [pid(2), pid(3)] },
      { setNumber: 2, team1: [pid(1), pid(3)], team2: [pid(2), pid(4)] },
      { setNumber: 3, team1: [pid(1), pid(2)], team2: [pid(3), pid(4)] },
    ];

    for (const s of sets) {
      if (!s.team1[0] || !s.team1[1] || !s.team2[0] || !s.team2[1]) continue;

      await tx.match.create({
        data: {
          groupId,
          setNumber: s.setNumber,
          team1Player1Id: s.team1[0]!,
          team1Player2Id: s.team1[1]!,
          team2Player1Id: s.team2[0]!,
          team2Player2Id: s.team2[1]!,
          team1Games: null,
          team2Games: null,
          tiebreakScore: null,
          isConfirmed: false,
          status: "PENDING",
        },
      });
    }
  }
}
