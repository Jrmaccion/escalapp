-- Prisma migration: add updatedAt to rounds with a safe default
-- This will backfill existing rows and keep a default for future inserts.

ALTER TABLE "rounds"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
