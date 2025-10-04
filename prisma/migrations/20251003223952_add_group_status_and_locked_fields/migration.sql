-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PLAYED', 'SKIPPED', 'POSTPONED');

-- AlterTable
ALTER TABLE "group_players" ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "graceEndAt" TIMESTAMP(3),
ADD COLUMN     "skippedReason" TEXT,
ADD COLUMN     "status" "GroupStatus" NOT NULL DEFAULT 'PENDING';
