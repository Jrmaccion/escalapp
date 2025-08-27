import { z } from 'zod'

export const createTournamentSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(100, 'Título muy largo'),
  description: z.string().max(500, 'Descripción muy larga').optional(),
  startDate: z.string().refine(date => new Date(date) > new Date(), {
    message: 'La fecha de inicio debe ser futura'
  }),
  totalRounds: z.number().min(3, 'Mínimo 3 rondas').max(20, 'Máximo 20 rondas'),
  roundDurationDays: z.number().min(7, 'Mínimo 7 días').max(30, 'Máximo 30 días'),
  isPublic: z.boolean().default(true)
})

export const matchResultSchema = z.object({
  groupId: z.string().cuid(),
  setNumber: z.number().min(1).max(3),
  team1Games: z.number().min(0).max(5),
  team2Games: z.number().min(0).max(5),
  tiebreakScore: z.string().regex(/^\d+-\d+$/).optional()
}).refine(data => {
  if (Math.max(data.team1Games, data.team2Games) < 4) {
    return false
  }
  
  if (data.team1Games === 4 && data.team2Games === 4 && !data.tiebreakScore) {
    return false
  }
  
  return true
}, {
  message: 'Resultado de partido inválido'
})

export const playerSchema = z.object({
  name: z.string().min(2, 'Nombre muy corto').max(50, 'Nombre muy largo'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña muy corta')
})
