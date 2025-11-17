# Solución: Error "Transaction already closed"

## 🔍 Qué causó el problema

El error **"Transaction already closed: A query cannot be executed on an expired transaction"** ocurre porque:

1. Las transacciones de Prisma tienen un **timeout por defecto de 5 segundos**
2. El cierre de ronda (`TournamentEngine.closeRoundAndGenerateNext`) puede tomar más de 5 segundos si hay muchos grupos
3. Cuando intentaste cerrar la ronda:
   - La transacción expiró a mitad de proceso
   - Quedó en estado inconsistente
   - Al intentar cerrar de nuevo, la transacción anterior ya está cerrada

## 🛠️ Solución Inmediata (Producción)

### Paso 1: Diagnosticar la ronda

Primero, verifica el estado actual de la ronda:

```bash
# En producción
npm run diagnose-round:prod
```

Cuando te pida el ID de la ronda, ingrésalo. El script te mostrará:
- Si la ronda está cerrada o abierta
- Qué grupos están completos
- Si hay inconsistencias en los datos

### Paso 2: Reparar la ronda (si es necesario)

Si el diagnóstico muestra problemas, ejecuta:

```bash
# En producción
npm run fix-stuck-round:prod
```

Este script te dará opciones para:
1. **Limpiar resultados sin confirmar** - Si hay partidos con resultados parciales
2. **Marcar grupos incompletos como SKIPPED** - Si algunos grupos no se jugaron
3. **Resetear estados de grupos** - Si los estados están corruptos
4. **Reabrir la ronda** - Si está cerrada pero necesitas hacer cambios

### Paso 3: Cerrar la ronda correctamente

Una vez reparada, cierra la ronda desde el panel de administración.

Si sigue fallando, usa `forceClose=true`:

**Opción A: Desde la UI**
- Ve al panel de administración
- Busca la opción de forzar cierre (si existe)

**Opción B: Desde la API (Postman/cURL)**
```bash
curl -X POST https://tu-dominio.com/api/rounds/[ROUND_ID]/close \
  -H "Content-Type: application/json" \
  -H "Cookie: tu-cookie-de-sesion" \
  -d '{"forceClose": true}'
```

## 🔧 Solución Permanente (Prevenir el problema)

El problema se debe a que las transacciones tienen timeout muy corto para operaciones complejas.

### Opción 1: Aumentar timeout de transacciones (RECOMENDADO)

Modifica `lib/tournament-engine.ts` en la línea 351:

**ANTES:**
```typescript
const roundData = await prisma.$transaction(async (tx) => {
  // ... código ...
});
```

**DESPUÉS:**
```typescript
const roundData = await prisma.$transaction(async (tx) => {
  // ... código ...
}, {
  maxWait: 15000,  // Esperar hasta 15s para adquirir la transacción
  timeout: 30000,  // Timeout de 30s para ejecutar la transacción
});
```

Haz lo mismo en:
- Línea 286 (`restoreFromSnapshot`)
- Línea 486 (`recalculatePositionsWithTiebreakers`)
- Línea 495 (segunda transacción en `recalculatePositionsWithTiebreakers`)
- Línea 823 (`_cleanRoundData`)

### Opción 2: Aumentar timeout global en withAdvisoryLock

Modifica `app/api/rounds/[id]/close/route.ts` en la línea 127:

**ANTES:**
```typescript
const result = await withAdvisoryLock(`round:${roundId}`, async (tx) => {
  // ... código ...
});
```

**DESPUÉS:**
```typescript
const result = await withAdvisoryLock(`round:${roundId}`, async (tx) => {
  // ... código ...
}, {
  timeoutMs: 15000, // Tiempo para adquirir el lock
});
```

Y en `lib/db-locks.ts`, aumenta el timeout de la transacción principal (línea 39):

**ANTES:**
```typescript
return prisma.$transaction(async (tx) => {
  // ... código ...
});
```

**DESPUÉS:**
```typescript
return prisma.$transaction(async (tx) => {
  // ... código ...
}, {
  maxWait: 15000,  // Esperar hasta 15s para adquirir la transacción
  timeout: 60000,  // Timeout de 60s para ejecutar (incluye el lock + operación)
});
```

## 📊 Monitoreo

Para prevenir este problema en el futuro:

1. **Monitorea el tiempo de cierre de rondas** - Si toma >5s consistentemente, es señal de que necesitas optimización
2. **Reduce el número de grupos por ronda** - Si tienes muchos grupos (>10), considera dividir el torneo
3. **Verifica logs** - Busca líneas como "Cerrando ronda" y mide el tiempo hasta "cerrada exitosamente"

## 🚨 Si nada funciona

Si después de todo esto la ronda sigue atascada:

1. **Contacta con un DBA o desarrollador senior**
2. **Considera hacer un backup de la base de datos**
3. **Manualmente ajusta los datos con prisma studio**:
   ```bash
   npm run db:studio
   ```
   - Verifica que `Round.isClosed = false`
   - Verifica que todos los `Match.isConfirmed = true` (o marca grupos como SKIPPED)
   - Verifica que `GroupPlayer.points` estén correctos

## 📝 Notas importantes

- **SIEMPRE haz backup antes de ejecutar scripts de reparación**
- Los scripts `diagnose-round` y `fix-stuck-round` son **seguros** para usar en producción
- Si tienes dudas, ejecuta primero en local con datos de prueba

## ✅ Checklist de recuperación

- [ ] Ejecuté `diagnose-round:prod` para ver el estado
- [ ] Identifiqué el problema (ronda cerrada/abierta, grupos con inconsistencias)
- [ ] Ejecuté `fix-stuck-round:prod` y seleccioné la opción apropiada
- [ ] Verifiqué que la ronda quedó en estado correcto
- [ ] Cerré la ronda exitosamente
- [ ] (Opcional) Apliqué la solución permanente para prevenir el problema
