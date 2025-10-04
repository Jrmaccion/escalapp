SELECT 
  g.number AS grupo,
  p.name AS jugador,
  gp.points,
  gp.position
FROM "group_players" gp
JOIN "groups"  g ON gp."groupId"  = g.id
JOIN "players" p ON gp."playerId" = p.id
JOIN "rounds"  r ON g."roundId"   = r.id
WHERE r."isClosed" = false
ORDER BY g.number, gp.position;
