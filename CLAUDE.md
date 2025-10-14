# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PadelRise** (formerly Escalapp) is a web application for managing padel "escalera" (ladder) tournaments. It automates round generation, result validation, dynamic rankings, and implements a sophisticated ladder movement system where player positions determine promotion/relegation between groups.

**Tech Stack:**
- Next.js 14 (App Router + Server Actions)
- TypeScript 5
- Prisma ORM with PostgreSQL (Neon in production)
- NextAuth.js (Credentials provider with roles)
- TailwindCSS + shadcn/ui components
- Docker support

## Development Commands

### Essential Commands
```bash
# Development
npm run dev                    # Start dev server on localhost:3000
npm run build                  # Production build
npm run start                  # Start production server

# Type checking & linting
npm run type-check             # TypeScript type checking (no emit)
npm run lint                   # Run ESLint

# Database operations
npm run db:generate            # Generate Prisma client
npm run db:migrate             # Run migrations in dev
npm run db:deploy              # Deploy migrations (production)
npm run db:studio              # Open Prisma Studio GUI
npm run db:seed                # Seed database with example data
npm run db:reset               # Reset DB and reseed (dev only)

# Production database operations
npm run db:deploy:prod         # Deploy migrations to production DB
npm run create-admin:prod      # Create admin user in production
npm run clean-neon             # Clean production database (DANGEROUS)

# Admin utilities
npm run create-admin           # Create admin user interactively
npm run estructura             # Generate project structure documentation
```

### Testing Database Operations
Always test database migrations locally before deploying to production. Use `db:reset` to start fresh during development.

## Architecture

### Core Domain Logic

The application revolves around **tournaments** composed of **rounds**, which contain **groups** of 4 players who play 3 **matches** (sets) against each other. After each round, players move between groups based on their position (ladder movement system).

#### Key Business Rules

**Ladder Movement (lib/tournament-engine.ts:133-173)**
- Position 1: Stays in elite group OR moves up 1-2 groups
- Position 2: Stays in elite OR moves up 1 group
- Position 3: Stays in bottom group OR moves down 1 group
- Position 4: Stays in bottom OR moves down 1-2 groups
- Movement depends on current group level (elite/middle/bottom)

**Match Structure**
- Each group of 4 players (positions 1-4) plays exactly 3 sets:
  - Set 1: (1+4) vs (2+3)
  - Set 2: (1+3) vs (2+4)
  - Set 3: (1+2) vs (3+4)
- Generated in lib/group-manager.ts:363-403

**Points & Tiebreakers (lib/points-calculator.ts)**
- Primary: Total points earned
- Tiebreaker cascade: Sets won → Games difference → H2H wins → Games won
- Position calculation in lib/tournament-engine.ts:452-510

**Comodín System (Wildcards)**
Two types of wildcards players can use once per tournament:
1. **Mean Comodin**: Skip round, receive 50% average points
2. **Substitute Comodin**: Another player substitutes, gets credit
- Implemented in lib/comodin.server.ts
- Can only be used before matches are confirmed or scheduled <24h
- Tracked in TournamentPlayer.comodinesUsed

**Continuity/Streak System**
- Bonus points for consecutive wins (sets/matches/position)
- Configurable per tournament (continuityEnabled, continuityPointsPerSet, etc.)
- Processed in lib/streak-calculator.ts
- Called during round closure: lib/tournament-engine.ts:338-347

**SKIPPED Groups**
Groups that aren't played receive special handling:
- If ALL groups skipped: No movements (frozen)
- If >50% skipped: No penalties for anyone
- Individual skips: Players penalized (down 1 group), receive technical points
- Technical points: R1-R2 = 50% round average, R≥3 = 50% personal average
- Implementation: lib/tournament-engine.ts:515-654, lib/points-calculator.ts:452-621

### Data Model Architecture

**Schema Location**: `prisma/schema.prisma`

**Core Entities:**
- `User` → 1:1 → `Player` (users have auth, players have tournament stats)
- `Tournament` → 1:N → `Round` → 1:N → `Group` → 1:N → `GroupPlayer`
- `Group` → 1:N → `Match` (3 matches per group)
- `TournamentPlayer` (junction table tracking player participation)
- `Ranking` (snapshot of player standings per round)
- `StreakHistory` (audit log of continuity bonuses)

**Important Relationships:**
- Each `GroupPlayer` has a `position` (1-4) determining match pairings
- `Match` references 4 player IDs (team1Player1Id, team1Player2Id, etc.)
- `GroupPlayer.usedComodin` and `substitutePlayerId` track wildcard usage

**Status Enums:**
- `MatchStatus`: PENDING → DATE_PROPOSED → SCHEDULED → COMPLETED
- `GroupStatus`: PENDING → IN_PROGRESS → PLAYED | SKIPPED | POSTPONED

### Authentication & Authorization

**NextAuth Configuration**: `lib/auth.ts`
- Credentials provider (email/password with bcrypt)
- JWT strategy with custom session data
- Session includes: `user.id`, `user.isAdmin`, `user.playerId`

**Middleware**: `middleware.ts`
- Protects all routes except `/`, `/auth/*`, `/public/*`, `/guia-rapida`
- Admin routes (`/admin/*`, `/api/admin/*`) require `isAdmin: true`
- Public API routes: `/api/public/*`, `/api/auth/*`

**Role-Based Access:**
- Admins: Full CRUD on tournaments, rounds, groups, players, results
- Players: View own dashboard, submit/confirm results, use wildcards

### API Routes Structure

**Pattern**: `app/api/[resource]/[id]/[action]/route.ts`

**Key Endpoints:**
- `POST /api/rounds/[id]/close` - Close round and generate next (uses TournamentEngine)
- `POST /api/rounds/[id]/generate-groups` - Create/reorganize groups manually
- `POST /api/rounds/[id]/generate-matches` - Generate match fixtures
- `POST /api/comodin/route.ts` - Apply wildcard for player
- `POST /api/comodin/revoke` - Revoke wildcard (if eligible)
- `GET /api/groups/[id]/points-preview` - Calculate provisional standings
- `POST /api/matches/[id]/confirm` - Confirm match result (double validation)
- `GET /api/player/dashboard` - Player's personalized dashboard data
- `GET /api/admin/tournaments/[id]/stats` - Tournament statistics

**API Conventions:**
- All routes use `NextResponse.json()` for responses
- Admin routes check `session.user.isAdmin`
- Player routes check `session.user.playerId`
- Use Prisma transactions for multi-step operations

### Critical Modules

**lib/tournament-engine.ts - Round Closure Engine**
- `TournamentEngine.closeRoundAndGenerateNext(roundId)` - Main orchestration method
- Validates integrity, processes streaks, calculates positions with tiebreakers
- Applies ladder movements, generates next round, updates rankings
- Includes rollback mechanism with snapshot/restore on failures
- Handles SKIPPED groups with specialized movement logic

**lib/group-manager.ts - Group Management**
- `GroupManager.updateRoundGroups()` - Create/update groups for a round
- `GroupManager.reorganizeGroups()` - Admin drag-and-drop reordering
- Enforces integrity: no duplicate players, valid positions, generates matches
- Used by tournament engine for next round generation

**lib/points-calculator.ts - Points & Previews**
- `getGroupPointsPreview(groupId)` - Calculate provisional standings
- `calculateTechnicalPoints()` - Points for SKIPPED groups
- `validateGroupIntegrity()` - Ensure group has 4 players, 3 matches, valid positions
- Implements full tiebreaker cascade

**lib/comodin.server.ts - Wildcard System**
- `useComodin(playerId, roundId, reason)` - Apply wildcard
- `revokeComodin(playerId, roundId)` - Remove wildcard (before matches)
- `getComodinStatus()` - Get wildcard eligibility/restrictions
- Only callable from server-side (API routes)

**lib/rounds.ts**
- `computeSubstituteCreditsForRound()` - Calculate points for substitute players
- Called during round closure to credit substitutes

**lib/match-validator.ts**
- Validates match results before confirmation
- Ensures proposer/confirmer are different players
- Checks score validity (games, tiebreak)

### Client-Side Architecture

**Server/Client Boundary:**
- Page components: Server Components by default (`app/**/page.tsx`)
- Interactive components: Use `"use client"` directive (e.g., `*Client.tsx` files)
- Data fetching: Server Components fetch directly, Client Components use API routes

**Component Patterns:**
```
app/admin/rounds/[id]/page.tsx        # Server Component (fetches data)
  └─> RoundDetailClient.tsx           # Client Component (interactivity)
        └─> components/ui/*            # shadcn/ui primitives
```

**Key Client Components:**
- `app/admin/AdminDashboardClient.tsx` - Admin overview with stats
- `app/dashboard/PlayerDashboardClient.tsx` - Player personalized view
- `components/GroupManagementPanel.tsx` - Drag-and-drop group editor
- `components/MatchEditDialog.tsx` - Match result submission/editing

**State Management:**
- React hooks (useState, useEffect) for local state
- Custom hooks in `hooks/` directory (useComodin, usePointsPreview)
- Form state: react-hook-form
- Toast notifications: react-hot-toast (via hooks/useToast)

### Database Access Patterns

**Prisma Client**: `lib/prisma.ts` (singleton instance)

**Common Patterns:**
```typescript
// Always include related data you need
const round = await prisma.round.findUnique({
  where: { id: roundId },
  include: {
    tournament: true,
    groups: {
      include: {
        players: true,
        matches: true
      }
    }
  }
});

// Use transactions for multi-step operations
await prisma.$transaction(async (tx) => {
  await tx.group.update({ where: { id }, data: { status: 'PLAYED' } });
  await tx.groupPlayer.updateMany({ where: { groupId: id }, data: { locked: true } });
});

// Use $queryRaw for complex aggregations (rankings)
const stats = await prisma.$queryRaw<any[]>`
  SELECT p.id, SUM(gp.points) as total
  FROM players p
  LEFT JOIN group_players gp ON p.id = gp."playerId"
  GROUP BY p.id
`;
```

**Performance Considerations:**
- Use `select` to limit fields when not all data is needed
- Use `include` carefully to avoid N+1 queries
- Leverage database indexes (defined in schema with `@@index`)
- Use `findFirst` instead of `findMany` when expecting single result

### Frontend Patterns

**Styling:**
- TailwindCSS utility classes
- Component variants with class-variance-authority (CVA)
- shadcn/ui components in `components/ui/`
- Animations with framer-motion

**Forms:**
```typescript
import { useForm } from 'react-hook-form';

const form = useForm({
  defaultValues: { ... }
});

const onSubmit = async (data) => {
  const response = await fetch('/api/endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  // Handle response
};
```

**Toast Notifications:**
```typescript
import toast from 'react-hot-toast';

toast.success('Operación exitosa');
toast.error('Error al procesar');
toast.loading('Procesando...');
```

## Common Workflows

### Adding a New Tournament Feature

1. Update `prisma/schema.prisma` if new fields needed
2. Run `npm run db:migrate` to create migration
3. Update relevant types in `types/` if needed
4. Implement business logic in `lib/tournament-engine.ts` or new lib file
5. Create/update API route in `app/api/tournaments/[id]/[feature]/route.ts`
6. Add UI in admin panel: `app/admin/tournaments/[id]/TournamentDetailClient.tsx`
7. Test with `npm run db:reset` and verify with `npm run db:studio`

### Modifying Ladder Movement Logic

1. Review current logic in `lib/tournament-engine.ts:calculateUnifiedLadderMovement()`
2. Update movement calculation function
3. Update `resolveSaturation()` if overflow handling changes
4. Run integration test by creating tournament, playing rounds, closing
5. Verify movements in admin panel and Prisma Studio

### Adding New API Endpoint

1. Create file: `app/api/[resource]/[action]/route.ts`
2. Export `GET`, `POST`, `PUT`, `DELETE` handlers
3. Check authentication: `await getServerSession(authOptions)`
4. Validate input with Zod or manual checks
5. Use Prisma transaction if multi-step
6. Return `NextResponse.json(data, { status: 200 })`
7. Handle errors with appropriate status codes

### Debugging Match/Group Issues

1. Use Prisma Studio: `npm run db:studio` to inspect data
2. Check Group.status (should be PLAYED for completed groups)
3. Verify Match.isConfirmed for all matches in group
4. Run `validateGroupIntegrity(groupId)` from points-calculator
5. Check logs for TournamentEngine operations during round closure
6. Verify GroupPlayer positions are 1-4 and unique per group

## Environment Variables

**Required in .env:**
```bash
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Optional: Email notifications
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="user@example.com"
SMTP_PASS="password"
SMTP_FROM="noreply@padelrise.com"
```

## Deployment

**Vercel (Primary):**
- Automatic deployments from GitHub
- Environment variables configured in Vercel dashboard
- Database: Neon PostgreSQL (serverless)
- Build command: `npm run vercel-build` (includes migrations)

**Docker (Alternative):**
```bash
docker-compose up -d
```
- Uses local PostgreSQL container
- Nginx reverse proxy included
- See `docker-compose.yml` and `Dockerfile`

## Important Constraints

1. **Groups must have exactly 4 players** - Hard requirement for match generation
2. **Matches must have 3 sets per group** - Enforced by group-manager
3. **Positions must be 1-4 and unique within group** - Enforced by schema and group-manager
4. **Round closure requires all non-SKIPPED matches confirmed** - Validated in tournament-engine
5. **Comodín can only be used once per tournament** - Tracked in TournamentPlayer.comodinesUsed
6. **Players cannot use wildcard if matches confirmed or scheduled <24h** - Enforced in comodin.server.ts
7. **Session must include playerId for player operations** - Set during authentication in lib/auth.ts

## Testing Considerations

When modifying core logic:
1. Test with fresh database: `npm run db:reset`
2. Create tournament with multiple rounds
3. Assign players to groups (4 per group)
4. Report and confirm match results
5. Close round and verify movements
6. Check rankings in admin panel
7. Verify SKIPPED group handling if applicable

## Code Style

- TypeScript strict mode enabled
- Use explicit return types for exported functions
- Prefer async/await over Promise chains
- Use Prisma transactions for multi-step database operations
- Log important operations with `console.log` (especially in tournament-engine)
- Handle errors gracefully and return user-friendly messages

## Prisma Tips

**Regenerate client after schema changes:**
```bash
npm run db:generate
```

**Create migration:**
```bash
npm run db:migrate
```

**View database in GUI:**
```bash
npm run db:studio
```

**Reset and reseed (dev only):**
```bash
npm run db:reset
```

## Additional Resources

- Prisma Schema: `prisma/schema.prisma`
- Seed data: `prisma/seed.ts`
- Project structure: `estructura-clave.txt`
- Example scripts: `scripts/` directory
