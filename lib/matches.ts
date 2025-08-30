// lib/matches.ts
import { prisma } from "@/lib/prisma";

/**
 * Genera la rotación de 3 sets para un grupo EXACTAMENTE de 4 jugadores.
 * players es un array de { id, position } ordenado por 'position' (1..4)
 */
export async function generateRotationForGroup(groupId: string, players: { id: string; position: number }[]) {
  if (players.length < 4) return;

  // Ordenar por position por si acaso
  const ps = [...players].sort((a, b) => a.position - b.position);
  const [p1, p2, p3, p4] = ps.map((p) => p.id);

  const payload = [
    // Set 1: #1 + #4 vs #2 + #3
    {
      setNumber: 1,
      team1Player1Id: p1,
      team1Player2Id: p4,
      team2Player1Id: p2,
      team2Player2Id: p3,
    },
    // Set 2: #1 + #3 vs #2 + #4
    {
      setNumber: 2,
      team1Player1Id: p1,
      team1Player2Id: p3,
      team2Player1Id: p2,
      team2Player2Id: p4,
    },
    // Set 3: #1 + #2 vs #3 + #4
    {
      setNumber: 3,
      team1Player1Id: p1,
      team1Player2Id: p2,
      team2Player1Id: p3,
      team2Player2Id: p4,
    },
  ];

  for (const m of payload) {
    await prisma.match.create({
      data: { groupId, ...m },
    });
  }
}
