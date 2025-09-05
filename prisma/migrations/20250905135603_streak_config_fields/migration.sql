-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "streakBonusMode" TEXT NOT NULL DEFAULT 'SETS',
ADD COLUMN     "streakEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "streakMaxBonusPerRound" DOUBLE PRECISION NOT NULL DEFAULT 6.0,
ADD COLUMN     "streakMinSetsForBonus" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "streakPointsPerMatchWin" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "streakPointsPerSetWin" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
ADD COLUMN     "streakResetOnLoss" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "streak_history" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "streakType" TEXT NOT NULL,
    "streakCount" INTEGER NOT NULL,
    "bonusPoints" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streak_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "streak_history" ADD CONSTRAINT "streak_history_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_history" ADD CONSTRAINT "streak_history_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_history" ADD CONSTRAINT "streak_history_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
