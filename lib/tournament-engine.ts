import { prisma } from './prisma'
import { addDays } from 'date-fns'
import { computeSubstituteCreditsForRound } from './rounds'

export class TournamentEngine {
  static async closeRoundAndGenerateNext(roundId: string) {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        tournament: true,
        groups: {
          include: {
            players: {
              include: { player: true },
              orderBy: { points: 'desc' }
            }
          },
          orderBy: { level: 'asc' }
        }
      }
    })

    if (!round || round.isClosed) {
      throw new Error('Ronda no encontrada o ya cerrada')
    }

    await prisma.round.update({
      where: { id: roundId },
      data: { isClosed: true }
    })

    // Calcular movimientos corregidos (1°→sube 2, 2°→sube 1, 3°→baja 1, 4°→baja 2)
    const movements = await this.calculateLadderMovements(round.groups)

    // Generar créditos de suplente antes de crear la siguiente ronda
    const substituteCredits = await computeSubstituteCreditsForRound(roundId)
    
    // Aplicar créditos de suplente a los rankings
    for (const credit of substituteCredits) {
      await this.applySubstituteCredit(round.tournament.id, credit)
    }

    if (round.number < round.tournament.totalRounds) {
      await this.generateNextRound(round.tournament.id, round.number + 1, movements)
    }

    await this.updateRankings(round.tournament.id, round.number)

    return { success: true, movements, substituteCredits }
  }

  /**
   * LÓGICA CORREGIDA: Movimientos entre grupos
   * - 1° lugar: sube 2 grupos
   * - 2° lugar: sube 1 grupo  
   * - 3° lugar: baja 1 grupo
   * - 4° lugar: baja 2 grupos
   */
  private static async calculateLadderMovements(groups: any[]) {
    const movements: any[] = []

    groups.forEach((group, groupIndex) => {
      group.players.forEach((player: any, position: number) => {
        let movement = 'same'
        let targetGroupChange = 0
        
        // 1° lugar: sube 2 grupos (si es posible)
        if (position === 0 && groupIndex > 0) {
          targetGroupChange = groupIndex >= 2 ? -2 : -1 // Sube 2 si puede, sino 1
          movement = 'up'
        }
        // 2° lugar: sube 1 grupo (si es posible)
        else if (position === 1 && groupIndex > 0) {
          targetGroupChange = -1
          movement = 'up'
        }
        // 3° lugar: baja 1 grupo (si es posible)
        else if (position === 2 && groupIndex < groups.length - 1) {
          targetGroupChange = 1
          movement = 'down'
        }
        // 4° lugar: baja 2 grupos (si es posible)
        else if (position === 3 && groupIndex < groups.length - 1) {
          targetGroupChange = groupIndex <= groups.length - 3 ? 2 : 1 // Baja 2 si puede, sino 1
          movement = 'down'
        }

        movements.push({
          playerId: player.playerId,
          currentGroup: groupIndex,
          currentPosition: position + 1,
          targetGroupChange,
          movement,
          points: player.points
        })
      })
    })

    return movements
  }

  private static async generateNextRound(tournamentId: string, roundNumber: number, movements: any[]) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        rounds: {
          where: { number: roundNumber - 1 },
          include: {
            groups: {
              include: {
                players: {
                  include: { player: true },
                  orderBy: { points: 'desc' }
                }
              },
              orderBy: { level: 'asc' }
            }
          }
        }
      }
    })

    if (!tournament) throw new Error('Torneo no encontrado')

    const previousRound = tournament.rounds[0]
    const startDate = new Date(previousRound.endDate)
    const endDate = addDays(startDate, tournament.roundDurationDays)

    const newRound = await prisma.round.create({
      data: {
        tournamentId,
        number: roundNumber,
        startDate,
        endDate,
        isClosed: false
      }
    })

    const newGroupsDistribution = this.redistributePlayersWithCorrectMovements(previousRound.groups, movements)

    for (let i = 0; i < newGroupsDistribution.length; i++) {
      const group = await prisma.group.create({
        data: {
          roundId: newRound.id,
          number: i + 1,
          level: i + 1
        }
      })

      // Crear jugadores en el grupo
      const playersInGroup = []
      for (let j = 0; j < newGroupsDistribution[i].length; j++) {
        const groupPlayer = await prisma.groupPlayer.create({
          data: {
            groupId: group.id,
            playerId: newGroupsDistribution[i][j].playerId,
            position: j + 1,
            points: 0,
            streak: this.calculateNewStreak(newGroupsDistribution[i][j], roundNumber),
            usedComodin: false,
            substitutePlayerId: null
          }
        })
        playersInGroup.push({
          id: newGroupsDistribution[i][j].playerId,
          position: j + 1
        })
      }

      // Generar matches automáticamente
      await this.generateGroupMatches(group.id, playersInGroup)
    }

    return newRound
  }

  /**
   * Redistribuye jugadores aplicando los movimientos corregidos
   */
  private static redistributePlayersWithCorrectMovements(groups: any[], movements: any[]) {
    const numGroups = groups.length
    const newDistribution: any[][] = Array(numGroups).fill(null).map(() => [])

    movements.forEach(movement => {
      let targetGroup = movement.currentGroup + movement.targetGroupChange
      
      // Asegurar que el grupo destino esté dentro de los límites
      targetGroup = Math.max(0, Math.min(numGroups - 1, targetGroup))

      newDistribution[targetGroup].push({
        playerId: movement.playerId,
        previousPoints: movement.points,
        movement: movement.movement
      })
    })

    // Ordenar jugadores en cada grupo por puntos de la ronda anterior (descendente)
    newDistribution.forEach(group => {
      group.sort((a, b) => b.previousPoints - a.previousPoints)
    })

    return newDistribution
  }

  /**
   * Genera automáticamente los 3 sets con rotación de parejas
   * Set 1: #1 + #4 vs #2 + #3
   * Set 2: #1 + #3 vs #2 + #4
   * Set 3: #1 + #2 vs #3 + #4
   */
  private static async generateGroupMatches(groupId: string, players: { id: string, position: number }[]) {
    if (players.length !== 4) {
      console.warn(`Grupo ${groupId} no tiene exactamente 4 jugadores. Matches no generados.`)
      return
    }

    // Ordenar por posición para asegurar orden correcto
    const sortedPlayers = players.sort((a, b) => a.position - b.position)

    const matchConfigurations = [
      {
        setNumber: 1,
        team1: [sortedPlayers[0], sortedPlayers[3]], // #1 + #4
        team2: [sortedPlayers[1], sortedPlayers[2]]  // #2 + #3
      },
      {
        setNumber: 2,
        team1: [sortedPlayers[0], sortedPlayers[2]], // #1 + #3
        team2: [sortedPlayers[1], sortedPlayers[3]]  // #2 + #4
      },
      {
        setNumber: 3,
        team1: [sortedPlayers[0], sortedPlayers[1]], // #1 + #2
        team2: [sortedPlayers[2], sortedPlayers[3]]  // #3 + #4
      }
    ]

    for (const config of matchConfigurations) {
      await prisma.match.create({
        data: {
          groupId,
          setNumber: config.setNumber,
          team1Player1Id: config.team1[0].id,
          team1Player2Id: config.team1[1].id,
          team2Player1Id: config.team2[0].id,
          team2Player2Id: config.team2[1].id,
          team1Games: null,
          team2Games: null,
          tiebreakScore: null,
          isConfirmed: false,
          reportedById: null,
          confirmedById: null,
          status: 'PENDING'
        }
      })
    }

    console.log(`Generados 3 matches para grupo ${groupId}`)
  }

  /**
   * Para crear manualmente grupos con matches (útil para admin)
   */
  static async createGroupWithMatches(roundId: string, groupNumber: number, level: number, playerIds: string[]) {
    if (playerIds.length !== 4) {
      throw new Error('Un grupo debe tener exactamente 4 jugadores')
    }

    const group = await prisma.group.create({
      data: {
        roundId,
        number: groupNumber,
        level
      }
    })

    const playersInGroup = []
    for (let i = 0; i < playerIds.length; i++) {
      const groupPlayer = await prisma.groupPlayer.create({
        data: {
          groupId: group.id,
          playerId: playerIds[i],
          position: i + 1,
          points: 0,
          streak: 0,
          usedComodin: false,
          substitutePlayerId: null
        }
      })
      playersInGroup.push({
        id: playerIds[i],
        position: i + 1
      })
    }

    await this.generateGroupMatches(group.id, playersInGroup)

    return group
  }

  private static calculateNewStreak(player: any, roundNumber: number) {
    // TODO: Implementar lógica de racha real
    // Por ahora mantener racha básica
    return 1
  }

  /**
   * NUEVO: Aplica créditos de suplente al ranking Ironman
   */
  private static async applySubstituteCredit(tournamentId: string, credit: {
    playerId: string;
    roundId: string;
    points: number;
    played: boolean;
  }) {
    // Crear un registro virtual en rankings para el crédito de suplente
    // Esto se sumará a los puntos totales pero no contará como ronda jugada
    try {
      await prisma.ranking.upsert({
        where: {
          tournamentId_playerId_roundNumber: {
            tournamentId,
            playerId: credit.playerId,
            roundNumber: 0 // Usar 0 para créditos de suplente
          }
        },
        update: {
          totalPoints: { increment: credit.points }
        },
        create: {
          tournamentId,
          playerId: credit.playerId,
          roundNumber: 0,
          totalPoints: credit.points,
          roundsPlayed: 0,
          averagePoints: 0,
          position: 999,
          ironmanPosition: 999,
          movement: 'substitute_credit'
        }
      })
    } catch (error) {
      console.warn(`No se pudo aplicar crédito de suplente para jugador ${credit.playerId}:`, error)
    }
  }

  private static async updateRankings(tournamentId: string, roundNumber: number) {
    const playersStats = await prisma.$queryRaw<any[]>`
      SELECT 
        p.id as playerId,
        p.name as playerName,
        COALESCE(SUM(gp.points), 0) as totalPoints,
        COUNT(CASE WHEN gp.usedComodin = false THEN 1 END) as roundsPlayed,
        CASE 
          WHEN COUNT(CASE WHEN gp.usedComodin = false THEN 1 END) > 0 
          THEN COALESCE(SUM(gp.points) / COUNT(CASE WHEN gp.usedComodin = false THEN 1 END), 0)
          ELSE 0 
        END as averagePoints
      FROM players p
      LEFT JOIN group_players gp ON p.id = gp.playerId
      LEFT JOIN groups g ON gp.groupId = g.id
      LEFT JOIN rounds r ON g.roundId = r.id
      WHERE r.tournamentId = ${tournamentId} AND r.isClosed = true
      GROUP BY p.id, p.name
      ORDER BY averagePoints DESC
    `

    for (let i = 0; i < playersStats.length; i++) {
      const player = playersStats[i]
      
      await prisma.ranking.upsert({
        where: {
          tournamentId_playerId_roundNumber: {
            tournamentId,
            playerId: player.playerId,
            roundNumber
          }
        },
        update: {
          totalPoints: player.totalPoints,
          roundsPlayed: player.roundsPlayed,
          averagePoints: player.averagePoints,
          position: i + 1,
          ironmanPosition: i + 1,
          movement: 'same'
        },
        create: {
          tournamentId,
          playerId: player.playerId,
          roundNumber,
          totalPoints: player.totalPoints,
          roundsPlayed: player.roundsPlayed,
          averagePoints: player.averagePoints,
          position: i + 1,
          ironmanPosition: i + 1,
          movement: 'new'
        }
      })
    }
  }
}