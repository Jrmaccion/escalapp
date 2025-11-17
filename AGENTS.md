# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds Next.js routes and components; keep feature logic colocated with its route folder.
- `components/` contains reusable UI pieces; add focused specs beside complex components.
- `lib/`, `hooks/`, and `types/` centralize utilities, custom hooks, and TypeScript contracts—reuse these instead of duplicating logic.
- `prisma/` stores the schema, migrations, and seeds; `scripts/` bundles TypeScript CLIs for database and maintenance tasks.
- Static assets live in `public/`; Tailwind config, middleware, and infra files sit at the repository root.

## Build, Test, and Development Commands
- `npm run dev` launches the Next.js dev server with hot reload.
- `npm run lint` runs ESLint with the Next.js ruleset; resolve all warnings before a PR.
- `npm run type-check` executes `tsc --noEmit` to guard shared contracts.
- `npm run build` compiles production assets; run it before shipping routing or data changes.
- Database helpers: `npm run db:migrate` for schema work, `npm run db:reset-local` to reseed, and `npm run db:studio` for Prisma Studio.

## Coding Style & Naming Conventions
- Follow the existing TypeScript + React stack with Prettier defaults (2-space indentation, semicolons on, double quotes).
- Use PascalCase for components, camelCase for variables, and SCREAMING_SNAKE_CASE for constants exported from `lib/`.
- Keep Tailwind classes grouped by layout → spacing → color; extract complex sets into `cn()` helpers in `lib/utils.ts`.
- Prefer server actions or API routes in `app/api/*` for mutations; keep direct Prisma calls inside dedicated service modules.

## Testing Guidelines
- Tests rely on Jest and Testing Library; place component specs in `__tests__/ComponentName.test.tsx` adjacent to the source.
- Mock Prisma by stubbing `lib/prisma.ts` with `jest.mock` or dependency injection so tests stay isolated from the database.
- Cover each new feature's happy path and one failure mode, and run `npx jest` before requesting review.

## Commit & Pull Request Guidelines
- Write concise, imperative commit subjects (`Fix ladder standings seed`, `Refine match invite email`); squash noisy checkpoint commits.
- PRs summarize intent, key changes, and migrations; note reviewer steps (e.g., `npm run db:migrate`), confirm lint/type-check/test commands, and link issues with screenshots or Looms for UI tweaks.

## Database & Environment Tips
- Copy `.env.example` to `.env.local`, supply `DATABASE_URL`, mail credentials, and feature flags before running scripts.
- Run `npm run db:pull-schema` after production changes. Treat `npm run db:restore-from-prod` as an emergency-only command with lead approval.
