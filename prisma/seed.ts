import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { addDays } from 'date-fns'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...')

  // Limpiar datos existentes
  await prisma.matchResult.deleteMany()
  await prisma.match.deleteMany()
  await prisma.groupPlayer.deleteMany()
  await prisma.group.deleteMany()
  await prisma.round.deleteMany()
  await prisma.ranking.deleteMany()
  await prisma.tournamentPlayer.deleteMany()
  await prisma.tournament.deleteMany()
  await prisma.player.deleteMany()
  await prisma.user.deleteMany()

  // Hash para contraseñas
  const hashedPassword = await bcrypt.hash('password123', 10)

  // Crear usuarios y jugadores
  const usersData = [
    { name: 'Carlos Martínez', email: 'carlos@escalapp.com', isAdmin: false },
    { name: 'Ana García', email: 'ana@escalapp.com', isAdmin: false },
    { name: 'Miguel López', email: 'miguel@escalapp.com', isAdmin: false },
    { name: 'Laura Rodríguez', email: 'laura@escalapp.com', isAdmin: false },
    { name: 'David Sánchez', email: 'david@escalapp.com', isAdmin: false },
    { name: 'Elena Fernández', email: 'elena@escalapp.com', isAdmin: false },
    { name: 'Javier Torres', email: 'javier@escalapp.com', isAdmin: false },
    { name: 'María González', email: 'maria@escalapp.com', isAdmin: false },
    { name: 'Pablo Ruiz', email: 'pablo@escalapp.com', isAdmin: false },
    { name: 'Sofía Moreno', email: 'sofia@escalapp.com', isAdmin: false },
    { name: 'Adrián Jiménez', email: 'adrian@escalapp.com', isAdmin: false },
    { name: 'Carmen Álvarez', email: 'carmen@escalapp.com', isAdmin: false },
    { name: 'Administrador', email: 'admin@escalapp.com', isAdmin: true }
  ]

  const users = []
  const players = []

  for (const userData of usersData) {
    const user = await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword
      }
    })
    users.push(user)

    if (!userData.isAdmin) {
      const player = await prisma.player.create({
        data: {
          userId: user.id,
          name: userData.name
        }
      })
      players.push(player)
    }
  }

  // Crear torneo
  const startDate = new Date('2025-03-01')
  const endDate = addDays(startDate, 6 * 14) // 6 rondas x 14 días

  const tournament = await prisma.tournament.create({
    data: {
      title: 'Torneo Escalera Primavera 2025',
      startDate,
      endDate,
      totalRounds: 6,
      roundDurationDays: 14,
      isActive: true,
      isPublic: true
    }
  })

  // Inscribir jugadores al torneo
  for (const player of players) {
    await prisma.tournamentPlayer.create({
      data: {
        tournamentId: tournament.id,
        playerId: player.id,
        joinedRound: 1
      }
    })
  }

  // Crear todas las rondas
  const rounds = []
  let currentStartDate = startDate

  for (let i = 1; i <= 6; i++) {
    const roundEndDate = addDays(currentStartDate, 14)
    
    const round = await prisma.round.create({
      data: {
        tournamentId: tournament.id,
        number: i,
        startDate: currentStartDate,
        endDate: roundEndDate,
        isClosed: i <= 2 // Primeras 2 rondas cerradas
      }
    })
    
    rounds.push(round)
    currentStartDate = roundEndDate
  }

  // Crear Ronda 1 (cerrada) con distribución aleatoria
  const round1 = rounds[0]
  const groups1 = []
  
  for (let i = 1; i <= 3; i++) {
    const group = await prisma.group.create({
      data: {
        roundId: round1.id,
        number: i,
        level: i
      }
    })
    groups1.push(group)
  }

  // Distribución inicial aleatoria en grupos
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5)
  
  // Grupo 1 (Nivel más alto)
  const group1Players = shuffledPlayers.slice(0, 4)
  for (let i = 0; i < 4; i++) {
    await prisma.groupPlayer.create({
      data: {
        groupId: groups1[0].id,
        playerId: group1Players[i].id,
        position: i + 1,
        points: 15 - (i * 2) + Math.random() * 2, // 15, 13, 11, 9 + variación
        streak: Math.floor(Math.random() * 3)
      }
    })
  }

  // Grupo 2 (Nivel medio)
  const group2Players = shuffledPlayers.slice(4, 8)
  for (let i = 0; i < 4; i++) {
    await prisma.groupPlayer.create({
      data: {
        groupId: groups1[1].id,
        playerId: group2Players[i].id,
        position: i + 1,
        points: 12 - (i * 1.5) + Math.random() * 2, // 12, 10.5, 9, 7.5 + variación
        streak: Math.floor(Math.random() * 2)
      }
    })
  }

  // Grupo 3 (Nivel más bajo)
  const group3Players = shuffledPlayers.slice(8, 12)
  for (let i = 0; i < 4; i++) {
    await prisma.groupPlayer.create({
      data: {
        groupId: groups1[2].id,
        playerId: group3Players[i].id,
        position: i + 1,
        points: 8 - (i * 1) + Math.random() * 2, // 8, 7, 6, 5 + variación
        streak: 0
      }
    })
  }

  // Crear algunos resultados de partidos para el Grupo 1
  const sampleMatches = [
    {
      groupId: groups1[0].id,
      setNumber: 1,
      team1Player1Id: group1Players[0].id,
      team1Player2Id: group1Players[3].id,
      team2Player1Id: group1Players[1].id,
      team2Player2Id: group1Players[2].id,
      team1Games: 4,
      team2Games: 2,
      isConfirmed: true,
      reportedById: group1Players[0].id,
      confirmedById: group1Players[1].id
    },
    {
      groupId: groups1[0].id,
      setNumber: 2,
      team1Player1Id: group1Players[0].id,
      team1Player2Id: group1Players[2].id,
      team2Player1Id: group1Players[1].id,
      team2Player2Id: group1Players[3].id,
      team1Games: 5,
      team2Games: 4,
      tiebreakScore: '7-5',
      isConfirmed: true,
      reportedById: group1Players[2].id,
      confirmedById: group1Players[3].id
    },
    {
      groupId: groups1[0].id,
      setNumber: 3,
      team1Player1Id: group1Players[0].id,
      team1Player2Id: group1Players[1].id,
      team2Player1Id: group1Players[2].id,
      team2Player2Id: group1Players[3].id,
      team1Games: 3,
      team2Games: 4,
      isConfirmed: false,
      reportedById: group1Players[2].id
    }
  ]

  for (const matchData of sampleMatches) {
    await prisma.match.create({ data: matchData })
  }

  // Crear Ronda 2 (cerrada) con movimientos aplicados
  const round2 = rounds[1]
  const groups2 = []
  
  for (let i = 1; i <= 3; i++) {
    const group = await prisma.group.create({
      data: {
        roundId: round2.id,
        number: i,
        level: i
      }
    })
    groups2.push(group)
  }

  // Simular movimientos de escalera para Ronda 2
  const newDistribution = [
    // Grupo 1: ganador de grupo 2 + 2º y 3º de grupo 1 + último de grupo superior ficticio
    [group2Players[0], group1Players[1], group1Players[2], group1Players[0]],
    // Grupo 2: último de grupo 1 + ganador de grupo 3 + 2º y 3º de grupo 2
    [group1Players[3], group3Players[0], group2Players[1], group2Players[2]],
    // Grupo 3: último de grupo 2 + 2º, 3º y 4º de grupo 3
    [group2Players[3], group3Players[1], group3Players[2], group3Players[3]]
  ]

  for (let groupIndex = 0; groupIndex < 3; groupIndex++) {
    for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
      await prisma.groupPlayer.create({
        data: {
          groupId: groups2[groupIndex].id,
          playerId: newDistribution[groupIndex][playerIndex].id,
          position: playerIndex + 1,
          points: 10 - (playerIndex * 1.5) + Math.random() * 2,
          streak: Math.floor(Math.random() * 2)
        }
      })
    }
  }

  // Crear Ronda 3 (activa) con movimientos aplicados
  const round3 = rounds[2]
  const groups3 = []
  
  for (let i = 1; i <= 3; i++) {
    const group = await prisma.group.create({
      data: {
        roundId: round3.id,
        number: i,
        level: i
      }
    })
    groups3.push(group)
  }

  // Nueva distribución para Ronda 3 (actual)
  const round3Distribution = [
    // Grupo 1
    [newDistribution[1][0], newDistribution[0][1], newDistribution[0][2], newDistribution[1][1]],
    // Grupo 2  
    [newDistribution[0][3], newDistribution[2][0], newDistribution[1][2], newDistribution[1][3]],
    // Grupo 3
    [newDistribution[2][1], newDistribution[2][2], newDistribution[2][3], group2Players[3]]
  ]

  for (let groupIndex = 0; groupIndex < 3; groupIndex++) {
    for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
      await prisma.groupPlayer.create({
        data: {
          groupId: groups3[groupIndex].id,
          playerId: round3Distribution[groupIndex][playerIndex].id,
          position: playerIndex + 1,
          points: 0, // Reset para nueva ronda
          streak: Math.floor(Math.random() * 2)
        }
      })
    }
  }

  // Agregar algunos resultados parciales a la ronda actual
  await prisma.match.create({
    data: {
      groupId: groups3[1].id, // Grupo 2 de la ronda actual
      setNumber: 1,
      team1Player1Id: round3Distribution[1][0].id,
      team1Player2Id: round3Distribution[1][3].id,
      team2Player1Id: round3Distribution[1][1].id,
      team2Player2Id: round3Distribution[1][2].id,
      team1Games: 4,
      team2Games: 2,
      isConfirmed: true,
      reportedById: round3Distribution[1][0].id,
      confirmedById: round3Distribution[1][1].id
    }
  })

  await prisma.match.create({
    data: {
      groupId: groups3[1].id,
      setNumber: 2,
      team1Player1Id: round3Distribution[1][0].id,
      team1Player2Id: round3Distribution[1][2].id,
      team2Player1Id: round3Distribution[1][1].id,
      team2Player2Id: round3Distribution[1][3].id,
      team1Games: 5,
      team2Games: 4,
      tiebreakScore: '7-5',
      isConfirmed: false,
      reportedById: round3Distribution[1][2].id
    }
  })

  // Crear rankings para las rondas cerradas
  for (let roundNum = 1; roundNum <= 2; roundNum++) {
    const roundGroups = roundNum === 1 ? [groups1, newDistribution] : [groups2, round3Distribution]
    
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      
      // Calcular estadísticas acumuladas hasta esta ronda
      const stats = await prisma.groupPlayer.findMany({
        where: {
          playerId: player.id,
          group: {
            round: {
              tournamentId: tournament.id,
              number: { lte: roundNum },
              isClosed: true
            }
          }
        }
      })
      
      const totalPoints = stats.reduce((sum, stat) => sum + stat.points, 0)
      const roundsPlayed = stats.length
      const averagePoints = roundsPlayed > 0 ? totalPoints / roundsPlayed : 0
      
      await prisma.ranking.create({
        data: {
          tournamentId: tournament.id,
          playerId: player.id,
          roundNumber: roundNum,
          totalPoints,
          roundsPlayed,
          averagePoints,
          position: i + 1, // Simplificado
          ironmanPosition: i + 1, // Simplificado
          movement: roundNum === 1 ? 'new' : 'same'
        }
      })
    }
  }

  console.log('✅ Seed completado con éxito!')
  console.log(`📊 Creado torneo: "${tournament.title}"`)
  console.log(`👥 ${players.length} jugadores inscritos`)
  console.log(`🎯 ${rounds.length} rondas creadas (2 cerradas, 1 activa, 3 futuras)`)
  console.log(`🏆 3 grupos por ronda con sistema de escalera`)
  console.log(`\n🔐 Credenciales de prueba:`)
  console.log(`📧 Admin: admin@escalapp.com / password123`)
  console.log(`📧 Jugador: carlos@escalapp.com / password123`)
  console.log(`📧 (Cualquier email listado) / password123`)
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

