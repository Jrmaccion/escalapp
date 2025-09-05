/*
  Warnings:

  - You are about to drop the column `streakBonusMode` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `streakEnabled` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `streakMaxBonusPerRound` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `streakMinSetsForBonus` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `streakPointsPerMatchWin` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `streakPointsPerSetWin` on the `tournaments` table. All the data in the column will be lost.
  - You are about to drop the column `streakResetOnLoss` on the `tournaments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tournaments" DROP COLUMN "streakBonusMode",
DROP COLUMN "streakEnabled",
DROP COLUMN "streakMaxBonusPerRound",
DROP COLUMN "streakMinSetsForBonus",
DROP COLUMN "streakPointsPerMatchWin",
DROP COLUMN "streakPointsPerSetWin",
DROP COLUMN "streakResetOnLoss",
ADD COLUMN     "continuityEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "continuityMaxBonus" DOUBLE PRECISION NOT NULL DEFAULT 9.0,
ADD COLUMN     "continuityMinRounds" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "continuityMode" TEXT NOT NULL DEFAULT 'MATCHES',
ADD COLUMN     "continuityPointsPerRound" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
ADD COLUMN     "continuityPointsPerSet" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
