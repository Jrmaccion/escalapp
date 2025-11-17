# Checklist de Pruebas - Mejoras UX FASE 1 + FASE 2

**Fecha:** 2025-11-17
**Servidor de desarrollo:** http://localhost:3000
**Estado:** ✅ Servidor iniciado y listo para pruebas

---

## 🎯 Objetivos de las Pruebas

Validar que las mejoras implementadas funcionan correctamente y que no hay regresiones en el sistema.

---

## ✅ Checklist de Pruebas Funcionales

### 1. Navegación y Redirects

#### 1.1 Login como Admin Puro (sin perfil de jugador)
- [ ] Ir a http://localhost:3000/auth/login
- [ ] Login con credenciales de admin puro
- [ ] **Esperado:** Debe redirigir a `/admin` (NO a `/admin/dashboard`)
- [ ] **Verificar:** URL en navegador debe ser `/admin`

#### 1.2 Login como Jugador
- [ ] Logout y volver a http://localhost:3000/auth/login
- [ ] Login con credenciales de jugador
- [ ] **Esperado:** Debe redirigir a `/dashboard`
- [ ] **Verificar:** Dashboard del jugador se muestra correctamente

#### 1.3 Login como Usuario con Doble Rol (Admin + Jugador)
- [ ] Login con usuario que tiene ambos roles
- [ ] **Esperado:** Debe ir a `/dashboard` (prioridad a jugador)
- [ ] **Verificar:** Ve tanto navegación de jugador como dropdown Admin

---

### 2. Navegación Reorganizada

#### 2.1 Navbar - Rankings en Navegación Primaria
- [ ] Estando logueado, revisar la barra de navegación
- [ ] **Esperado:** Rankings aparece en la navegación principal (junto a "Inicio", "Mi Grupo")
- [ ] **Antes:** Rankings estaba en dropdown "Más"
- [ ] Click en "Rankings" y verificar que lleva a `/clasificaciones`

#### 2.2 Dropdown Admin Destacado
- [ ] Si tienes rol admin, verificar dropdown "Admin"
- [ ] **Esperado:**
  - Dropdown tiene header "Panel de Administración" con fondo naranja
  - Opciones: Dashboard, Torneos, Rondas, Jugadores, Rankings
  - Iconos destacados con estilo visual mejorado
- [ ] **Antes:** Dropdown genérico sin header especial

#### 2.3 Dropdown "Más" (solo si hay rutas secundarias)
- [ ] Verificar si aparece dropdown "Más"
- [ ] **Esperado:** Solo aparece si hay rutas secundarias (Historial, Guía)
- [ ] **No debe estar:** Rankings (ya está en navegación primaria)

---

### 3. Componente Unificado de Rankings

#### 3.1 Página de Rankings Jugador (`/clasificaciones`)
- [ ] Ir a http://localhost:3000/clasificaciones
- [ ] **Verificar estructura:**
  - [ ] Título "Rankings" con nombre del torneo
  - [ ] Selector de torneo (dropdown) funcional
  - [ ] Botón de refresh
  - [ ] **Tabs:** "Oficial (Media)" y "Ironman (Total)"
- [ ] **Tab Oficial:**
  - [ ] Jugadores ordenados por promedio de puntos
  - [ ] Badges visuales: 🥇 oro (1º), 🥈 plata (2º), 🥉 bronce (3º)
  - [ ] Top 5 con badge azul
  - [ ] Resto con badge outline
  - [ ] Columnas: Posición, Jugador, Puntos (media), Rondas, Movimiento
  - [ ] Tu usuario destacado con borde azul y badge "Tú"
  - [ ] Iconos de movimiento: ⬆️ (verde), ⬇️ (rojo), ➖ (gris)
- [ ] **Tab Ironman:**
  - [ ] Cambiar a tab "Ironman (Total)"
  - [ ] Jugadores ordenados por puntos totales
  - [ ] Mismo formato visual pero header naranja
  - [ ] Info box naranja: "Ordenado por total de puntos"
- [ ] **Footer de tabla:**
  - [ ] Total de jugadores
  - [ ] Leyenda de iconos de movimiento

#### 3.2 Página de Rankings Admin (`/admin/rankings`)
- [ ] Ir a http://localhost:3000/admin/rankings
- [ ] **Verificar header:**
  - [ ] Título "Rankings - Admin"
  - [ ] Subtítulo con nombre torneo + total jugadores
  - [ ] Botón "Exportar CSV"
  - [ ] Selector de torneo
  - [ ] Botón refresh
- [ ] **Exportar CSV:**
  - [ ] Click en "Exportar CSV"
  - [ ] **Esperado:** Se descarga archivo `rankings-{tournamentId}.csv`
  - [ ] Abrir CSV y verificar formato: Posición, Jugador, Puntos Totales, Promedio, Rondas, Movimiento
- [ ] **Tabla de rankings:**
  - [ ] Mismo componente que `/clasificaciones` pero con badge "Modo Admin"
  - [ ] Tabs funcionan igual
  - [ ] No debería ver el badge "Tú" destacado (es vista admin)

#### 3.3 Selector de Torneo
- [ ] En `/clasificaciones` o `/admin/rankings`, usar el selector de torneo
- [ ] **Verificar:**
  - [ ] Click abre lista de torneos
  - [ ] Torneos activos aparecen primero con badge "Activo"
  - [ ] Torneos finalizados aparecen abajo con badge "Finalizado"
  - [ ] Cambiar torneo actualiza rankings automáticamente
  - [ ] Loader aparece durante carga

---

### 4. Comportamiento de API

#### 4.1 Endpoint Unificado `/api/rankings`
- [ ] Abrir DevTools → Network
- [ ] Navegar a `/clasificaciones`
- [ ] **Verificar:**
  - [ ] Se hace fetch a `/api/rankings?tournamentId=...`
  - [ ] Respuesta JSON con estructura:
    ```json
    {
      "tournamentId": "...",
      "tournamentTitle": "...",
      "roundNumber": 1,
      "official": [...],
      "ironman": [...]
    }
    ```
  - [ ] Campo `isCurrentUser: true` para tu jugador

#### 4.2 Auto-selección de Torneo Activo
- [ ] Navegar a `/clasificaciones` SIN parámetro tournamentId
- [ ] **Esperado:** Automáticamente carga el torneo activo
- [ ] Si no hay torneo activo, debe mostrar mensaje "No hay torneo disponible"

---

### 5. Estados de Carga y Errores

#### 5.1 Estado de Carga
- [ ] Navegar a `/clasificaciones`
- [ ] **Esperado:** Ver spinner con texto "Cargando rankings..."
- [ ] Transición suave a tabla de rankings

#### 5.2 Estado de Error
- [ ] Simular error (detener servidor DB temporalmente)
- [ ] Refrescar `/clasificaciones`
- [ ] **Esperado:**
  - [ ] Card roja con mensaje "Error al cargar rankings"
  - [ ] Botón "Intentar de nuevo" funcional

#### 5.3 Sin Datos
- [ ] Con torneo sin rondas cerradas
- [ ] **Esperado:** Mensaje "No hay datos de ranking disponibles"

---

### 6. Responsive Design

#### 6.1 Modo Móvil (< 768px)
- [ ] Abrir DevTools → Device Mode (iPhone)
- [ ] Navegar a `/clasificaciones`
- [ ] **Verificar:**
  - [ ] Tabla es scrollable horizontalmente
  - [ ] Tabs se ven correctamente
  - [ ] Selector de torneo se adapta al ancho
  - [ ] Badges no se rompen

#### 6.2 Modo Tablet (768px - 1024px)
- [ ] Cambiar a iPad en DevTools
- [ ] **Verificar:** Layout se ve bien, columnas legibles

#### 6.3 Modo Desktop (> 1024px)
- [ ] Vista normal de escritorio
- [ ] **Verificar:** Tabla usa max-width, centrada en página

---

### 7. Regresiones (No debe haber cambios)

#### 7.1 Otras Páginas No Modificadas
- [ ] `/mi-grupo` - Debe funcionar igual
- [ ] `/historial` - Debe funcionar igual
- [ ] `/dashboard` - Debe funcionar igual (excepto admin redirect)
- [ ] `/admin` dashboard - Debe funcionar igual

#### 7.2 Funcionalidades Existentes
- [ ] Login/Logout funcionan
- [ ] Creación de torneos funciona
- [ ] Gestión de rondas funciona
- [ ] Reporte de resultados funciona
- [ ] Sistema de comodines funciona

---

### 8. Performance

#### 8.1 Tiempo de Carga
- [ ] Abrir DevTools → Network
- [ ] Navegar a `/clasificaciones`
- [ ] **Verificar:**
  - [ ] Página carga en < 2 segundos
  - [ ] API responde en < 500ms
  - [ ] No hay requests duplicados

#### 8.2 Bundle Size
- [ ] En Network, filtrar por JS
- [ ] **Verificar:**
  - [ ] `/clasificaciones` tiene bundle pequeño (~126 kB según build)
  - [ ] `/admin/rankings` similar (~126 kB)
  - [ ] Componente compartido se carga una sola vez

---

## 🐛 Bugs Conocidos a Verificar

### Bug 1: Ruta `/admin/dashboard` (DEBE DAR 404)
- [ ] Navegar manualmente a http://localhost:3000/admin/dashboard
- [ ] **Esperado:** 404 o redirect a `/admin`
- [ ] **Antes:** Alias que redirigía (ahora eliminado)

### Bug 2: Rankings en Dropdown "Más"
- [ ] Verificar dropdown "Más"
- [ ] **Esperado:** Rankings NO debe estar aquí
- [ ] **Debe estar:** En navegación primaria

---

## 📊 Métricas de Validación

Al completar las pruebas, verificar:

- [ ] **0 errores críticos** - Todo funciona
- [ ] **Reducción de código visible** - Componentes más simples
- [ ] **UX mejorada** - Rankings más accesible, navegación más clara
- [ ] **Sin regresiones** - Funcionalidades existentes intactas

---

## 🚀 Próximos Pasos Después de Validación

Si todas las pruebas pasan:

1. [ ] Crear commit con mensaje descriptivo
2. [ ] Push a repositorio
3. [ ] Crear Pull Request (opcional)
4. [ ] Deploy a producción (Vercel)
5. [ ] Verificar en producción

---

## 📝 Notas de Desarrollo

**Archivos principales creados/modificados:**
- `lib/hooks/useRankingsData.ts` - Hook compartido
- `components/rankings/UnifiedRankingsTable.tsx` - Componente unificado
- `app/api/rankings/route.ts` - API endpoint
- `app/clasificaciones/ClasificacionesClient.tsx` - Refactorizado
- `app/admin/rankings/RankingsClient.tsx` - Refactorizado
- `components/Navigation.tsx` - Reorganizado

**Código eliminado:**
- ~500 líneas de código duplicado
- `app/admin/dashboard/page.tsx` (alias innecesario)

**Sin breaking changes:**
- Rutas existentes funcionan igual
- API backward compatible
- Solo `/admin/dashboard` ahora da 404 (era alias innecesario)

---

**Tiempo estimado de pruebas:** 20-30 minutos
**Prioridad:** Alta (validar antes de deploy a producción)
