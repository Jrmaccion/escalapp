# 🎾 PadelRise

Aplicación web para gestionar **torneos escalera de pádel**.  
Automatiza la generación de rondas, validación de resultados, rankings dinámicos y mucho más.  

🚀 Construido con **Next.js 14**, **TypeScript**, **Prisma ORM**, **TailwindCSS**, **NextAuth** y **Docker**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Jrmaccion/padelrise)

---

## ✨ Funcionalidades principales

- 🏆 **Sistema de escalera automático** (1º sube, 4º baja, 2º-3º se mantienen).
- 👥 **Gestión de jugadores y grupos** con drag & drop para administradores.
- 📊 **Rankings duales**: oficial (media) e ironman (acumulado).
- ✅ **Validación doble** de resultados (jugador que reporta + jugador que confirma).
- 📸 **Subida de actas en foto** y edición de marcador antes de aprobar.
- 🔔 **Notificaciones por email** con recordatorios (72h y 24h antes del cierre).
- 📈 **Estadísticas y timeline visual** del progreso de cada jugador.
- 🔒 Roles: administrador / jugador.
- 📱 **Mobile-first UI** con shadcn/ui y framer-motion.

---

## 🛠️ Instalación y ejecución en local

### 1. Clonar el proyecto
```bash
git clone git@github.com:Jrmaccion/padelrise.git
cd padelrise
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Variables de entorno
Copia `.env.example` a `.env`:
```bash
cp .env.example .env
```
y ajusta según tu configuración (base de datos, NextAuth, SMTP, etc.).

### 4. Migraciones y seed
Genera la base de datos SQLite y carga datos de prueba:
```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 5. Arrancar el servidor
```bash
npm run dev
```

Accede en [http://localhost:3000](http://localhost:3000)

---

## 🔐 Credenciales de prueba

Al ejecutar el seed, se crean usuarios de ejemplo:

- **Admin**  
  Email: `admin@padelrise.com`  
  Password: `password123`

- **Jugadores** (ejemplos, todos con `password123`):  
  `carlos@padelrise.com`, `ana@padelrise.com`, `miguel@padelrise.com`, etc.

---

## 🐳 Uso con Docker

También puedes levantarlo con Docker:

```bash
docker-compose up -d
```

Esto creará los contenedores de app + base de datos y expondrá el servicio en `http://localhost:3000`.

---

## 📂 Estructura del proyecto

```
app/                 # Rutas App Router (Next.js 14)
  ├─ auth/           # Login, error, registro
  ├─ admin/          # Panel de administración (torneos, jugadores, rondas, resultados)
  ├─ dashboard/      # Dashboard de usuario
  └─ api/            # Rutas API (Next.js + Prisma)

components/ui/       # UI basada en shadcn/ui
lib/                 # Prisma, Auth, lógica de negocio
prisma/              # Schema, migraciones, seed
types/               # Tipos extendidos
```

---

## 📦 Scripts disponibles

```bash
npm run dev          # Arrancar en desarrollo
npm run build        # Build de producción
npm run start        # Servir en producción
npm run lint         # Linter
npm run db:generate  # Generar cliente Prisma
npm run db:migrate   # Migrar DB en desarrollo
npm run db:seed      # Poblar DB con datos de ejemplo
npm run db:studio    # Prisma Studio (UI para DB)
```

---

## 👨‍💻 Desarrollo

- **Next.js 14 (App Router + Server Actions)**
- **TypeScript 5**
- **Prisma ORM (SQLite)**
- **NextAuth.js (Credentials provider + roles)**
- **TailwindCSS + shadcn/ui**
- **Docker + docker-compose**
- **ESLint + Prettier**

---

## 📜 Licencia

MIT © 2025 [Jrmaccion](https://github.com/Jrmaccion)

---

## 🚀 Roadmap

- [ ] Gestión multi-torneo
- [ ] Integración con pagos (Stripe)
- [ ] App móvil (React Native)
- [ ] Exportación de estadísticas a PDF/Excel