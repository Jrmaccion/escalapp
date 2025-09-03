-- MIGRACIÓN REPARADORA / DINÁMICA / IDEMPOTENTE
-- Detecta nombres de tablas en tiempo de ejecución (CamelCase vs snake_case),
-- asegura enum y columnas sin reventar si ya existen.

-- === 1) Enum MatchStatus asegurado ===
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

-- === 2) Helpers para localizar tablas ===
DO $$
DECLARE
  t_tournament    regclass;
  t_tournamentply regclass;
  t_groupplayer   regclass;
  t_player        regclass;
  idx_exists      boolean;
  fk_exists       boolean;
BEGIN
  -- Detectar nombres reales (CamelCase o snake_case)
  SELECT COALESCE(to_regclass('public."Tournament"'), to_regclass('public.tournament'))
    INTO t_tournament;
  SELECT COALESCE(to_regclass('public."TournamentPlayer"'), to_regclass('public.tournament_player'))
    INTO t_tournamentply;
  SELECT COALESCE(to_regclass('public."GroupPlayer"'), to_regclass('public.group_player'))
    INTO t_groupplayer;
  SELECT COALESCE(to_regclass('public."Player"'), to_regclass('public.player'))
    INTO t_player;

  -- === Tournament: substituteCreditFactor / substituteMaxAppearances ===
  IF t_tournament IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS "substituteCreditFactor" DOUBLE PRECISION', t_tournament);
    EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS "substituteMaxAppearances" INTEGER', t_tournament);
    EXECUTE format('UPDATE %s SET "substituteCreditFactor" = COALESCE("substituteCreditFactor", 1.0), "substituteMaxAppearances" = COALESCE("substituteMaxAppearances", 2)', t_tournament);
    EXECUTE format('ALTER TABLE %s ALTER COLUMN "substituteCreditFactor" SET NOT NULL', t_tournament);
    EXECUTE format('ALTER TABLE %s ALTER COLUMN "substituteCreditFactor" SET DEFAULT 1.0', t_tournament);
    EXECUTE format('ALTER TABLE %s ALTER COLUMN "substituteMaxAppearances" SET NOT NULL', t_tournament);
    EXECUTE format('ALTER TABLE %s ALTER COLUMN "substituteMaxAppearances" SET DEFAULT 2', t_tournament);
  ELSE
    RAISE NOTICE 'Tabla Tournament no encontrada, se omite.';
  END IF;

  -- === TournamentPlayer: substituteAppearances ===
  IF t_tournamentply IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS "substituteAppearances" INTEGER', t_tournamentply);
    EXECUTE format('UPDATE %s SET "substituteAppearances" = COALESCE("substituteAppearances", 0)', t_tournamentply);
    EXECUTE format('ALTER TABLE %s ALTER COLUMN "substituteAppearances" SET NOT NULL', t_tournamentply);
    EXECUTE format('ALTER TABLE %s ALTER COLUMN "substituteAppearances" SET DEFAULT 0', t_tournamentply);
  ELSE
    RAISE NOTICE 'Tabla TournamentPlayer no encontrada, se omite.';
  END IF;

  -- === GroupPlayer: campos de comodín/suplente + defaults ===
  IF t_groupplayer IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS "substitutePlayerId" TEXT', t_groupplayer);
    EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS "comodinAt" TIMESTAMP(3)', t_groupplayer);
    EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS "comodinReason" TEXT', t_groupplayer);

    -- defaults/normalizaciones
    EXECUTE format('UPDATE %s SET "points" = 0 WHERE "points" IS NULL', t_groupplayer);
    EXECUTE format('ALTER TABLE %s ALTER COLUMN "points" SET DEFAULT 0', t_groupplayer);
    EXECUTE format('ALTER TABLE %s ALTER COLUMN "usedComodin" SET DEFAULT false', t_groupplayer);

    -- FK a Player (si existe tabla Player)
    IF t_player IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
          FROM information_schema.table_constraints
         WHERE constraint_type = 'FOREIGN KEY'
           AND constraint_name = 'GroupPlayer_substitutePlayerId_fkey'
      ) INTO fk_exists;

      IF NOT fk_exists THEN
        EXECUTE format(
          'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY ("substitutePlayerId") REFERENCES %s("id") ON DELETE SET NULL ON UPDATE CASCADE',
          t_groupplayer,
          'GroupPlayer_substitutePlayerId_fkey',
          t_player
        );
      END IF;
    END IF;

    -- Índice para substitutePlayerId
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes 
       WHERE schemaname = 'public'
         AND indexname = 'GroupPlayer_substitutePlayer_idx'
    ) INTO idx_exists;
    IF NOT idx_exists THEN
      EXECUTE format('CREATE INDEX %I ON %s ("substitutePlayerId")',
        'GroupPlayer_substitutePlayer_idx', t_groupplayer);
    END IF;
  ELSE
    RAISE NOTICE 'Tabla GroupPlayer no encontrada, se omite.';
  END IF;
END$$;
