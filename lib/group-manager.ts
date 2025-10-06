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
  groupId?: string;
  level?: number | null;
  number?: number;
  players: GroupPlayerInput[];
};

export type UpdateRoundGroupsOptions = {
  deleteExisting?: boolean;
  generateMatches?: boolean;
  validateIntegrity?: boolean;
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
  targetGroupLevel: number;
  targetPosition?: number;
};

export class GroupManager {
  // ===========================
  // API pública
  // ===========================

  static async updateRoundGroups(
    roundId: string,
    groupsData: GroupInput[],
    opts: UpdateRoundGroupsOptions = {
      deleteExisting: false,
      generateMatches: false,
      validateIntegrity: true,
    }
  ): Promise<UpdateRoundGroupsResult> {
    if (!Array.isArray(groupsData) || groupsData.length === 0) {
      throw new Error("No se han proporcionado grupos para crear.");
    }

    if (opts.validateIntegrity) {
      this.ensureNoDuplicatePlayersAcrossGroups(groupsData);
      this.ensureNoDuplicatePositionsWithinGroups(groupsData);
    }

    const result = await prisma.$transaction(async (tx) => {
      const round = await tx.round.findUnique({
        where: { id: roundId },
        include: { groups: { include: { players: true, matches: true } } },
      });
      if (!round) throw new Error("Ronda no encontrada.");
      if (round.isClosed)
        throw new Error("La ronda está cerrada y no se puede modificar.");

      if (opts.deleteExisting) {
        await this._deleteRoundGroupsAndMatches(tx, roundId);
      }

      let playersAssigned = 0;
      const createdGroups: { id: string; number: number }[] = [];

      for (let i = 0; i < groupsData.length; i++) {
        const g = groupsData[i];
        const groupNumber = g.number ?? i + 1;

        const group = await tx.group.create({
          data: {
            roundId,
            number: groupNumber,
            level: g.level ?? groupNumber,
          },
        });
        createdGroups.push({ id: group.id, number: groupNumber });

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

    const groupsData: GroupInput[] = groups.map((g, idx) => ({
      groupId: g.groupId,
      level: g.level ?? idx + 1,
      number: idx + 1,
      players: g.playerIds.map((pid, pIdx) => ({
        playerId: pid,
        position: pIdx + 1,
      })),
    }));

    this.ensureNoDuplicatePlayersAcrossGroups(groupsData);
    this.ensureNoDuplicatePositionsWithinGroups(groupsData);

    const result = await prisma.$transaction(async (tx) => {
      const round = await tx.round.findUnique({
        where: { id: roundId },
        include: {
          groups: { include: { players: true, matches: true } },
        },
      });
      if (!round) throw new Error("Ronda no encontrada.");
      if (round.isClosed)
        throw new Error("La ronda está cerrada y no se puede modificar.");

      let playersAssigned = 0;
      let groupsUpdated = 0;
      const existingById = new Map(round.groups.map((g) => [g.id, g]));

      for (let i = 0; i < groupsData.length; i++) {
        const g = groupsData[i];
        const number = g.number ?? i + 1;

        let groupId = g.groupId;
        if (groupId && !existingById.has(groupId)) {
          groupId = undefined;
        }

        if (!groupId) {
          const created = await tx.group.create({
            data: { roundId, number, level: g.level ?? number },
          });
          groupId = created.id;
          existingById.set(groupId, {
            ...created,
            players: [],
            matches: [],
          } as any);
        } else {
          await tx.group.update({
            where: { id: groupId },
            data: { level: g.level ?? number, number },
          });
        }

        // 🔒 BORRA TODOS LOS JUGADORES DEL GRUPO ANTES DE REINSERTAR
        // (evita colisiones UNIQUE (groupId, position) ante residuos previos)
        await tx.groupPlayer.deleteMany({ where: { groupId } });

        // Borrar partidos del grupo (composición cambia)
        await tx.match.deleteMany({ where: { groupId } });

        // Reinsertar jugadores con posiciones 1..N
        for (const p of g.players) {
          await tx.groupPlayer.create({
            data: {
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
        message:
          "Grupos reorganizados correctamente. Los partidos existentes de los grupos modificados han sido eliminados.",
      } as ReorganizeGroupsResult;
    });

    return result;
  }

  static async applyLadderMovements(
    fromRoundId: string,
    toRoundId: string,
    movements: ApplyMovementsInput[]
  ): Promise<{ success: boolean; message: string }> {
    if (!Array.isArray(movements) || movements.length === 0) {
      return { success: true, message: "No hay movimientos a aplicar." };
    }

    await prisma.$transaction(async (tx) => {
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

      const min = Math.min(...Array.from(groupsByLevel.keys()));
      const max = Math.max(...Array.from(groupsByLevel.keys()));

      for (const mv of movements) {
        const clampedLevel = Math.max(min, Math.min(max, mv.targetGroupLevel));
        const target = groupsByLevel.get(clampedLevel);
        if (!target) continue;

        await this._placePlayerInGroup(
          tx,
          target.id,
          mv.playerId,
          mv.targetPosition
        );
      }

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

      await tx.match.deleteMany({ where: { group: { roundId: toRoundId } } });
    });

    return {
      success: true,
      message: "Movimientos aplicados y posiciones normalizadas.",
    };
  }

  // ===========================
  // Helpers internos
  // ===========================

  private static ensureNoDuplicatePlayersAcrossGroups(groups: GroupInput[]) {
    const seen = new Set<string>();
    for (const g of groups) {
      for (const p of g.players) {
        if (seen.has(p.playerId)) {
          throw new Error(
            `Integridad: el jugador ${p.playerId} aparece en más de un grupo.`
          );
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
          throw new Error(
            `Integridad: posiciones duplicadas en el grupo #${idx + 1} (posición ${pos}).`
          );
        }
        positions.add(pos);
      }
    }
  }

  private static async _deleteRoundGroupsAndMatches(
    tx: Prisma.TransactionClient,
    roundId: string
  ) {
    await tx.match.deleteMany({ where: { group: { roundId } } });
    await tx.groupPlayer.deleteMany({ where: { group: { roundId } } });
    await tx.group.deleteMany({ where: { roundId } });
  }

  private static async _placePlayerInGroup(
    tx: Prisma.TransactionClient,
    groupId: string,
    playerId: string,
    targetPosition?: number
  ) {
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

    let position = targetPosition;
    if (!position) {
      const count = await tx.groupPlayer.count({ where: { groupId } });
      position = count + 1;
    }

    await tx.groupPlayer.create({ data: { groupId, playerId, position } });
  }

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

    const pid = (pos: number) =>
      players.find((p) => p.position === pos)?.playerId;

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

  /**
   * Método público para exponer la generación de partidos desde endpoints externos.
   */
  static async generateMatchesForGroup(
    tx: Prisma.TransactionClient,
    groupId: string
  ) {
    return await this._generateMatchesForGroup(tx, groupId);
  }
}
