// lib/party-manager.ts - VERSIÓN EXTENDIDA CON FUNCIONALIDAD ADMIN
import { prisma } from "@/lib/prisma";
import type { MatchStatus } from "@prisma/client";

/**
 * Un "Partido" representa los 3 sets completos entre 4 jugadores de un grupo
 * Esta es una abstracción sobre el modelo actual donde Match = Set individual
 */
export type Party = {
  id: string; // groupId (usar como identificador único del partido)
  groupId: string;
  groupNumber: number;
  roundNumber: number;
  roundId: string;

  // Jugadores participantes
  players: Array<{
    id: string;
    name: string;
    position: number;
  }>;

  // Sets que componen el partido
  sets: Array<{
    id: string; // matchId
    setNumber: number;
    team1Player1Id: string;
    team1Player1Name: string;
    team1Player2Id: string;
    team1Player2Name: string;
    team2Player1Id: string;
    team2Player1Name: string;
    team2Player2Id: string;
    team2Player2Name: string;
    team1Games: number | null;
    team2Games: number | null;
    tiebreakScore: string | null;
    hasResult: boolean;
    isConfirmed: boolean;
  }>;

  // Estado de programación (propiedades planas para facilidad de uso)
  status: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED";
  proposedDate: Date | null;
  acceptedDate: Date | null;
  proposedBy: string | null;
  acceptedBy: string[]; // IDs de usuarios que han aceptado
  acceptedCount: number;
  totalPlayersNeeded: number; // Siempre 4
  proposedByCurrentUser?: boolean;
  canSchedule: boolean; // Si el usuario actual puede programar fechas

  // Progreso del partido (propiedades planas)
  totalSets: number;
  completedSets: number;
  playedSets: number; // Con resultado pero sin confirmar
  pendingSets: number;
  isComplete: boolean;

  // Estado de programación anidado (para compatibilidad)
  schedule: {
    status: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED";
    proposedDate: Date | null;
    acceptedDate: Date | null;
    proposedBy: string | null;
    acceptedBy: string[];
    acceptedCount: number;
    totalPlayersNeeded: number;
    proposedByCurrentUser?: boolean;
  };

  // Progreso anidado (para compatibilidad)
  progress: {
    totalSets: number;
    completedSets: number;
    playedSets: number;
    pendingSets: number;
    isComplete: boolean;
  };
};

export class PartyManager {
  /**
   * Obtiene un partido completo basado en el groupId
   */
  static async getParty(groupId: string, currentUserId?: string | null): Promise<Party | null> {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        round: {
          include: {
            tournament: { select: { id: true, title: true } },
          },
        },
        players: {
          include: { player: { include: { user: true } } },
          orderBy: { position: "asc" },
        },
        matches: {
          include: {
            proposer: { select: { id: true, name: true } },
          },
          orderBy: { setNumber: "asc" },
        },
      },
    });

    if (!group || group.matches.length === 0) {
      return null;
    }

    // Extraer datos del grupo
    const players = group.players.map((gp) => ({
      id: gp.player.id,
      name: gp.player.name,
      position: gp.position,
    }));

    // Procesar sets
    const sets = group.matches.map((match) => ({
      id: match.id,
      setNumber: match.setNumber,
      team1Player1Id: match.team1Player1Id,
      team1Player1Name: this.getPlayerName(match.team1Player1Id, players),
      team1Player2Id: match.team1Player2Id,
      team1Player2Name: this.getPlayerName(match.team1Player2Id, players),
      team2Player1Id: match.team2Player1Id,
      team2Player1Name: this.getPlayerName(match.team2Player1Id, players),
      team2Player2Id: match.team2Player2Id,
      team2Player2Name: this.getPlayerName(match.team2Player2Id, players),
      team1Games: match.team1Games,
      team2Games: match.team2Games,
      tiebreakScore: match.tiebreakScore,
      hasResult: match.team1Games !== null && match.team2Games !== null,
      isConfirmed: match.isConfirmed,
    }));

    // Calcular estado de programación unificado
    const schedule = this.calculateScheduleStatus(group.matches, currentUserId);

    // Calcular progreso
    const progress = this.calculateProgress(sets);

    // Determinar si el usuario actual puede programar
    const canSchedule = currentUserId ? await this.verifyUserPermission(groupId, currentUserId) : false;

    return {
      id: groupId,
      groupId: groupId,
      groupNumber: group.number,
      roundNumber: group.round.number,
      roundId: group.round.id,
      players,
      sets,

      // Propiedades planas para facilidad de uso en APIs
      status: schedule.status,
      proposedDate: schedule.proposedDate,
      acceptedDate: schedule.acceptedDate,
      proposedBy: schedule.proposedBy,
      acceptedBy: schedule.acceptedBy,
      acceptedCount: schedule.acceptedCount,
      totalPlayersNeeded: schedule.totalPlayersNeeded,
      proposedByCurrentUser: schedule.proposedByCurrentUser,
      canSchedule,

      totalSets: progress.totalSets,
      completedSets: progress.completedSets,
      playedSets: progress.playedSets,
      pendingSets: progress.pendingSets,
      isComplete: progress.isComplete,

      // Propiedades anidadas para compatibilidad
      schedule,
      progress,
    };
  }

  /**
   * 🔧 MODIFICADO: Proponer fecha con detección de admin
   */
  static async proposePartyDate(
    groupId: string,
    proposedDate: Date,
    proposedByUserId: string,
    isAdmin: boolean = false
  ): Promise<{ success: boolean; message: string; party?: Party }> {
    try {
      // Si es admin, usar método específico de admin
      if (isAdmin) {
        return this.adminSetPartyDate(groupId, proposedDate, proposedByUserId, {
          skipApproval: false,
          forceScheduled: false,
        });
      }

      // Verificar que el grupo existe y el usuario puede proponer
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          round: { select: { isClosed: true } },
          matches: { select: { id: true } },
        },
      });

      if (!group) {
        return { success: false, message: "Grupo no encontrado" };
      }

      if (group.round.isClosed) {
        return { success: false, message: "La ronda está cerrada" };
      }

      if (group.matches.length === 0) {
        return { success: false, message: "No hay sets programados para este grupo" };
      }

      // Verificar permisos del usuario
      const hasPermission = await this.verifyUserPermission(groupId, proposedByUserId);
      if (!hasPermission) {
        return { success: false, message: "No tienes permisos para proponer fecha en este grupo" };
      }

      // Actualizar todos los matches del grupo
      await prisma.match.updateMany({
        where: { groupId },
        data: {
          proposedDate,
          proposedById: proposedByUserId,
          acceptedDate: null,
          acceptedBy: [proposedByUserId], // El que propone automáticamente acepta
          status: "DATE_PROPOSED" as MatchStatus,
        },
      });

      const updatedParty = await this.getParty(groupId, proposedByUserId);

      return {
        success: true,
        message: "Fecha propuesta correctamente para todo el partido",
        party: updatedParty || undefined,
      };
    } catch (error) {
      console.error("Error proposing party date:", error);
      return { success: false, message: "Error interno del servidor" };
    }
  }

  /**
   * 🔧 NUEVO: Método específico para admin - establece fecha con opciones
   */
  static async adminSetPartyDate(
    groupId: string,
    proposedDate: Date,
    adminUserId: string,
    options: {
      skipApproval?: boolean;
      forceScheduled?: boolean;
      notifyPlayers?: boolean;
    } = {}
  ): Promise<{ success: boolean; message: string; party?: Party }> {
    try {
      // Verificar que es admin
      const admin = await prisma.user.findUnique({
        where: { id: adminUserId },
        select: { isAdmin: true },
      });

      if (!admin?.isAdmin) {
        return { success: false, message: "Solo admins pueden usar esta funcionalidad" };
      }

      // Verificar que el grupo existe
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          round: { select: { isClosed: true } },
          matches: { select: { id: true } },
        },
      });

      if (!group) {
        return { success: false, message: "Grupo no encontrado" };
      }

      if (group.round.isClosed) {
        return { success: false, message: "La ronda está cerrada" };
      }

      if (group.matches.length === 0) {
        return { success: false, message: "No hay sets programados para este grupo" };
      }

      // Determinar estado final según opciones
      let finalStatus: MatchStatus = "DATE_PROPOSED";
      let acceptedDate: Date | null = null;
      let acceptedBy: string[] = [adminUserId];

      if (options.skipApproval || options.forceScheduled) {
        // Admin fuerza la fecha como confirmada
        finalStatus = "SCHEDULED";
        acceptedDate = proposedDate;

        // Obtener todos los jugadores del grupo para marcarlos como "aceptados"
        if (options.forceScheduled) {
          const allPlayerIds = await this.getAllPlayerIdsFromGroup(groupId);
          const allUserIds = await this.getUserIdsFromPlayerIds(allPlayerIds);
          acceptedBy = [...new Set([...allUserIds, adminUserId])];
        }
      }

      // Actualizar todos los matches del grupo
      await prisma.match.updateMany({
        where: { groupId },
        data: {
          proposedDate,
          proposedById: adminUserId,
          acceptedDate,
          acceptedBy,
          status: finalStatus,
        },
      });

      // (Opcional) Notificaciones
      if (options.notifyPlayers) {
        // Aquí podrías encolar una notificación/email para los jugadores del grupo
        // await NotificationService.notifyGroupScheduling(groupId, proposedDate, finalStatus);
      }

      // Log de acción admin
      console.log(
        `Admin ${adminUserId} estableció fecha para grupo ${groupId}: ${proposedDate.toISOString()} (estado: ${finalStatus})`
      );

      // Devolver el partido actualizado
      const updatedParty = await this.getParty(groupId, adminUserId);

      const message = options.forceScheduled
        ? "Fecha establecida y confirmada automáticamente por admin"
        : options.skipApproval
        ? "Fecha propuesta con bypass de validaciones de admin"
        : "Fecha establecida por admin";

      return {
        success: true,
        message,
        party: updatedParty || undefined,
      };
    } catch (error) {
      console.error("Error in admin set party date:", error);
      return { success: false, message: "Error interno del servidor" };
    }
  }

  /**
   * 🔧 NUEVO: Cancelar/resetear fecha (solo admin)
   */
  static async adminCancelPartyDate(
    groupId: string,
    adminUserId: string
  ): Promise<{ success: boolean; message: string; party?: Party }> {
    try {
      // Verificar admin
      const admin = await prisma.user.findUnique({
        where: { id: adminUserId },
        select: { isAdmin: true },
      });

      if (!admin?.isAdmin) {
        return { success: false, message: "Solo admins pueden cancelar fechas" };
      }

      // Resetear estado de programación
      await prisma.match.updateMany({
        where: { groupId },
        data: {
          proposedDate: null,
          proposedById: null,
          acceptedDate: null,
          acceptedBy: [],
          status: "PENDING" as MatchStatus,
        },
      });

      console.log(`Admin ${adminUserId} canceló fecha para grupo ${groupId}`);

      const updatedParty = await this.getParty(groupId, adminUserId);
      return {
        success: true,
        message: "Fecha cancelada por admin",
        party: updatedParty || undefined,
      };
    } catch (error) {
      console.error("Error in admin cancel party date:", error);
      return { success: false, message: "Error interno del servidor" };
    }
  }

  /**
   * Responde a una propuesta de fecha (aceptar/rechazar)
   */
  static async respondToPartyDate(
    groupId: string,
    action: "accept" | "reject",
    userId: string
  ): Promise<{ success: boolean; message: string; party?: Party }> {
    try {
      // Verificar permisos
      const hasPermission = await this.verifyUserPermission(groupId, userId);
      if (!hasPermission) {
        return { success: false, message: "No tienes permisos para responder en este grupo" };
      }

      if (action === "reject") {
        // Cancelar propuesta
        await prisma.match.updateMany({
          where: { groupId },
          data: {
            proposedDate: null,
            proposedById: null,
            acceptedDate: null,
            acceptedBy: [],
            status: "PENDING" as MatchStatus,
          },
        });

        const updatedParty = await this.getParty(groupId, userId);
        return {
          success: true,
          message: "Fecha rechazada. Se puede proponer una nueva.",
          party: updatedParty || undefined,
        };
      }

      // Aceptar fecha
      const matches = await prisma.match.findMany({
        where: { groupId },
        select: {
          id: true,
          proposedDate: true,
          acceptedBy: true,
          team1Player1Id: true,
          team1Player2Id: true,
          team2Player1Id: true,
          team2Player2Id: true,
        },
      });

      if (matches.length === 0 || !matches[0].proposedDate) {
        return { success: false, message: "No hay fecha propuesta para aceptar" };
      }

      // Obtener todos los jugadores del grupo
      const allPlayerIds = new Set<string>();
      matches.forEach((match) => {
        allPlayerIds.add(match.team1Player1Id);
        allPlayerIds.add(match.team1Player2Id);
        allPlayerIds.add(match.team2Player1Id);
        allPlayerIds.add(match.team2Player2Id);
      });

      // Añadir usuario actual a la lista de aceptados
      const currentAccepted = new Set(matches[0].acceptedBy || []);
      currentAccepted.add(userId);

      // Verificar si todos han aceptado
      const allUsersAccepted = await this.checkAllUsersAccepted(
        Array.from(allPlayerIds),
        Array.from(currentAccepted)
      );

      const updateData: any = {
        acceptedBy: Array.from(currentAccepted),
      };

      if (allUsersAccepted) {
        updateData.acceptedDate = matches[0].proposedDate;
        updateData.status = "SCHEDULED" as MatchStatus;
      }

      await prisma.match.updateMany({
        where: { groupId },
        data: updateData,
      });

      const updatedParty = await this.getParty(groupId, userId);
      const message = allUsersAccepted
        ? "Fecha confirmada por todos los jugadores"
        : "Fecha aceptada. Esperando confirmación de otros jugadores.";

      return {
        success: true,
        message,
        party: updatedParty || undefined,
      };
    } catch (error) {
      console.error("Error responding to party date:", error);
      return { success: false, message: "Error interno del servidor" };
    }
  }

  /**
   * Obtiene estadísticas resumidas de todos los partidos de una ronda (visión general)
   */
  static async getRoundPartyStats(roundId: string): Promise<{
    totalParties: number;
    scheduledParties: number;
    completedParties: number;
    pendingParties: number;
  }> {
    const groups = await prisma.group.findMany({
      where: { roundId },
      include: {
        matches: {
          select: {
            status: true,
            isConfirmed: true,
            acceptedDate: true,
          },
        },
      },
    });

    const stats = {
      totalParties: groups.length,
      scheduledParties: 0,
      completedParties: 0,
      pendingParties: 0,
    };

    for (const group of groups) {
      if (group.matches.length === 0) {
        stats.pendingParties++;
        continue;
      }

      const completedSets = group.matches.filter((m) => m.isConfirmed).length;
      const hasScheduledDate = group.matches[0]?.acceptedDate !== null;

      if (completedSets === group.matches.length) {
        stats.completedParties++;
      } else if (hasScheduledDate) {
        stats.scheduledParties++;
      } else {
        stats.pendingParties++;
      }
    }

    return stats;
  }

  /**
   * 🔧 NUEVO: Obtener estadísticas de programación para admin
   */
  static async getAdminSchedulingStats(roundId: string): Promise<{
    totalGroups: number;
    pendingSchedule: number;
    proposedSchedule: number;
    scheduledGroups: number;
    completedGroups: number;
    groupDetails: Array<{
      groupId: string;
      groupNumber: number;
      status: string;
      proposedDate: Date | null;
      acceptedDate: Date | null;
      acceptedCount: number;
      completedSets: number;
      totalSets: number;
    }>;
  }> {
    const groups = await prisma.group.findMany({
      where: { roundId },
      include: {
        matches: {
          select: {
            id: true,
            status: true,
            proposedDate: true,
            acceptedDate: true,
            acceptedBy: true,
            isConfirmed: true,
          },
        },
      },
      orderBy: { number: "asc" },
    });

    let pendingSchedule = 0;
    let proposedSchedule = 0;
    let scheduledGroups = 0;
    let completedGroups = 0;

    const groupDetails = groups.map((group) => {
      const completedSets = group.matches.filter((m) => m.isConfirmed).length;
      const totalSets = group.matches.length;

      let status: "PENDING" | "DATE_PROPOSED" | "SCHEDULED" | "COMPLETED" = "PENDING";
      let proposedDate: Date | null = null;
      let acceptedDate: Date | null = null;
      let acceptedCount = 0;

      if (group.matches.length > 0) {
        const firstMatch = group.matches[0];
        proposedDate = firstMatch.proposedDate;
        acceptedDate = firstMatch.acceptedDate;
        acceptedCount = (firstMatch.acceptedBy || []).length;

        if (completedSets === totalSets) {
          status = "COMPLETED";
          completedGroups++;
        } else if (acceptedDate) {
          status = "SCHEDULED";
          scheduledGroups++;
        } else if (proposedDate) {
          status = "DATE_PROPOSED";
          proposedSchedule++;
        } else {
          status = "PENDING";
          pendingSchedule++;
        }
      } else {
        pendingSchedule++;
      }

      return {
        groupId: group.id,
        groupNumber: group.number,
        status,
        proposedDate,
        acceptedDate,
        acceptedCount,
        completedSets,
        totalSets,
      };
    });

    return {
      totalGroups: groups.length,
      pendingSchedule,
      proposedSchedule,
      scheduledGroups,
      completedGroups,
      groupDetails,
    };
  }

  // =====================
  // Métodos auxiliares privados
  // =====================

  private static getPlayerName(playerId: string, players: Array<{ id: string; name: string }>): string {
    return players.find((p) => p.id === playerId)?.name || "Jugador desconocido";
  }

  private static calculateScheduleStatus(matches: any[], currentUserId?: string | null): Party["schedule"] {
    if (matches.length === 0) {
      return {
        status: "PENDING",
        proposedDate: null,
        acceptedDate: null,
        proposedBy: null,
        acceptedBy: [],
        acceptedCount: 0,
        totalPlayersNeeded: 4,
      };
    }

    const firstMatch = matches[0];
    const status = this.deriveScheduleStatus(matches);

    return {
      status,
      proposedDate: firstMatch.proposedDate,
      acceptedDate: firstMatch.acceptedDate,
      proposedBy: firstMatch.proposedById,
      acceptedBy: firstMatch.acceptedBy || [],
      acceptedCount: (firstMatch.acceptedBy || []).length,
      totalPlayersNeeded: 4,
      proposedByCurrentUser: currentUserId ? firstMatch.proposedById === currentUserId : false,
    };
  }

  private static deriveScheduleStatus(matches: any[]): Party["schedule"]["status"] {
    if (matches.length === 0) return "PENDING";

    const completedSets = matches.filter((m: any) => m.isConfirmed).length;
    if (completedSets === matches.length) return "COMPLETED";

    const firstMatch = matches[0];
    if (firstMatch.acceptedDate) return "SCHEDULED";
    if (firstMatch.proposedDate) return "DATE_PROPOSED";

    return "PENDING";
  }

  private static calculateProgress(sets: Party["sets"]): Party["progress"] {
    const totalSets = sets.length;
    const completedSets = sets.filter((s) => s.isConfirmed).length;
    const playedSets = sets.filter((s) => s.hasResult && !s.isConfirmed).length;
    const pendingSets = totalSets - completedSets - playedSets;

    return {
      totalSets,
      completedSets,
      playedSets,
      pendingSets,
      isComplete: completedSets === totalSets,
    };
  }

  private static async verifyUserPermission(groupId: string, userId: string): Promise<boolean> {
    // Verificar que el usuario es jugador del grupo
    const playerInGroup = await prisma.groupPlayer.findFirst({
      where: {
        groupId,
        player: {
          user: { id: userId },
        },
      },
    });

    return !!playerInGroup;
  }

  private static async checkAllUsersAccepted(playerIds: string[], acceptedUserIds: string[]): Promise<boolean> {
    // Obtener userIds de todos los jugadores
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      include: { user: { select: { id: true } } },
    });

    const allUserIds = players.map((p) => p.user?.id).filter(Boolean) as string[];

    return allUserIds.every((userId) => acceptedUserIds.includes(userId));
  }

  // 🔧 MÉTODOS AUXILIARES NUEVOS

  private static async getAllPlayerIdsFromGroup(groupId: string): Promise<string[]> {
    const matches = await prisma.match.findMany({
      where: { groupId },
      select: {
        team1Player1Id: true,
        team1Player2Id: true,
        team2Player1Id: true,
        team2Player2Id: true,
      },
      take: 1, // Solo necesitamos un match para obtener todos los jugadores
    });

    if (matches.length === 0) return [];

    const match = matches[0];
    return [
      match.team1Player1Id,
      match.team1Player2Id,
      match.team2Player1Id,
      match.team2Player2Id,
    ];
    }

  private static async getUserIdsFromPlayerIds(playerIds: string[]): Promise<string[]> {
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      include: { user: { select: { id: true } } },
    });

    return players.map((p) => p.user?.id).filter(Boolean) as string[];
  }
}
