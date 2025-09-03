-- MIGRACIÓN REPARADORA / IDPOTENTE
-- Garantiza enum MatchStatus y columnas/valores usados por el sistema de comodines/suplentes,
-- sin romper si ya existen (IF NOT EXISTS).

-- === Enum MatchStatus (si no existe, créalo; si existe, aseguremos valores) ===
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MatchStatus') THEN
    CREATE TYPE "MatchStatus" AS ENUM ('PENDING','SCHEDULED','IN_PROGRESS','COMPLETED');
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MatchStatus') THEN
    ALTER TYPE "MatchStatus" ADD VALUE IF NOT EXISTS 'PENDING';
    ALTER TYPE "MatchStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
    ALTER TYPE "MatchStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
    ALTER TYPE "MatchStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
  END IF;
END$$;

-- === Tournament: factores de suplente ===
ALTER TABLE "Tournament" 
  ADD COLUMN IF NOT EXISTS "substituteCreditFactor" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "substituteMaxAppearances" INTEGER;

UPDATE "Tournament"
SET "substituteCreditFactor" = COALESCE("substituteCreditFactor", 1.0),
    "substituteMaxAppearances" = COALESCE("substituteMaxAppearances", 2);

ALTER TABLE "Tournament" 
  ALTER COLUMN "substituteCreditFactor" SET NOT NULL,
  ALTER COLUMN "substituteCreditFactor" SET DEFAULT 1.0,
  ALTER COLUMN "substituteMaxAppearances" SET NOT NULL,
  ALTER COLUMN "substituteMaxAppearances" SET DEFAULT 2;

-- === TournamentPlayer: contador de apariciones como suplente ===
ALTER TABLE "TournamentPlayer" 
  ADD COLUMN IF NOT EXISTS "substituteAppearances" INTEGER;

UPDATE "TournamentPlayer"
SET "substituteAppearances" = COALESCE("substituteAppearances", 0);

ALTER TABLE "TournamentPlayer"
  ALTER COLUMN "substituteAppearances" SET NOT NULL,
  ALTER COLUMN "substituteAppearances" SET DEFAULT 0;

-- === GroupPlayer: campos de comodín/suplente ===
ALTER TABLE "GroupPlayer" 
  ADD COLUMN IF NOT EXISTS "substitutePlayerId" TEXT,
  ADD COLUMN IF NOT EXISTS "comodinAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "comodinReason" TEXT;

-- Asegurar defaults coherentes con la app
UPDATE "GroupPlayer" SET "points" = 0 WHERE "points" IS NULL;

ALTER TABLE "GroupPlayer"
  ALTER COLUMN "points" SET DEFAULT 0,
  ALTER COLUMN "usedComodin" SET DEFAULT false;

-- FK opcional a Player (si no existiera)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'GroupPlayer_substitutePlayerId_fkey'
  ) THEN
    ALTER TABLE "GroupPlayer"
      ADD CONSTRAINT "GroupPlayer_substitutePlayerId_fkey"
      FOREIGN KEY ("substitutePlayerId") REFERENCES "Player"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Índice para substitutePlayerId (si no existiera)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
     WHERE schemaname = 'public' 
       AND indexname = 'GroupPlayer_substitutePlayer_idx'
  ) THEN
    CREATE INDEX "GroupPlayer_substitutePlayer_idx" ON "GroupPlayer" ("substitutePlayerId");
  END IF;
END$$;
