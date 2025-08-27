import { prisma } from './prisma'
import { addDays } from 'date-fns'

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
          }
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

    const movements = await this.calculateLadderMovements(round.groups)

    if (round.number < round.tournament.totalRounds) {
      await this.generateNextRound(round.tournament.id, round.number + 1, movements)
    }

    await this.updateRankings(round.tournament.id, round.number)

    return { success: true, movements }
  }

  private static async calculateLadderMovements(groups: any[]) {
    const movements: any[] = []

    groups.forEach((group, groupIndex) => {
      group.players.forEach((player: any, position: number) => {
        let movement = 'same'
        
        if (position === 0 && groupIndex > 0) {
          movement = 'up'
        } else if (position === 3 && groupIndex < groups.length - 1) {
          movement = 'down'
        }

        movements.push({
          playerId: player.playerId,
          currentGroup: groupIndex,
          currentPosition: position + 1,
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

    const newGroupsDistribution = this.redistributePlayers(previousRound.groups, movements)

    for (let i = 0; i < newGroupsDistribution.length; i++) {
      const group = await prisma.group.create({
        data: {
          roundId: newRound.id,
          number: i + 1,
          level: i + 1
        }
      })

      for (let j = 0; j < newGroupsDistribution[i].length; j++) {
        await prisma.groupPlayer.create({
          data: {
            groupId: group.id,
            playerId: newGroupsDistribution[i][j].playerId,
            position: j + 1,
            points: 0,
            streak: this.calculateNewStreak(newGroupsDistribution[i][j])
          }
        })
      }
    }

    return newRound
  }

  private static redistributePlayers(groups: any[], movements: any[]) {
    const numGroups = groups.length
    const newDistribution: any[][] = Array(numGroups).fill(null).map(() => [])

    movements.forEach(movement => {
      let targetGroup = movement.currentGroup

      if (movement.movement === 'up' && movement.currentGroup > 0) {
        targetGroup = movement.currentGroup - 1
      } else if (movement.movement === 'down' && movement.currentGroup < numGroups - 1) {
        targetGroup = movement.currentGroup + 1
      }

      newDistribution[targetGroup].push({
        playerId: movement.playerId,
        previousPoints: movement.points
      })
    })

    return newDistribution
  }

  private static calculateNewStreak(player: any) {
    return 1
  }

  private static async updateRankings(tournamentId: string, roundNumber: number) {
    const playersStats = await prisma.$queryRaw<any[]>`
      SELECT 
        p.id as playerId,
        p.name as playerName,
        COALESCE(SUM(gp.points), 0) as totalPoints,
        COUNT(gp.id) as roundsPlayed,
        COALESCE(AVG(gp.points), 0) as averagePoints
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
