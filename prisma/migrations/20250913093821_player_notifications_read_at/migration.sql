-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "disputeReason" TEXT,
ADD COLUMN     "disputedAt" TIMESTAMP(3),
ADD COLUMN     "disputedBy" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "notificationsReadAt" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "group_players_playerId_idx" ON "group_players"("playerId");

-- CreateIndex
CREATE INDEX "group_players_groupId_points_idx" ON "group_players"("groupId", "points");

-- CreateIndex
CREATE INDEX "matches_groupId_status_idx" ON "matches"("groupId", "status");

-- CreateIndex
CREATE INDEX "matches_isConfirmed_idx" ON "matches"("isConfirmed");

-- CreateIndex
CREATE INDEX "rounds_tournamentId_number_idx" ON "rounds"("tournamentId", "number");

-- CreateIndex
CREATE INDEX "rounds_isClosed_idx" ON "rounds"("isClosed");

-- CreateIndex
CREATE INDEX "tournaments_isActive_idx" ON "tournaments"("isActive");

-- CreateIndex
CREATE INDEX "tournaments_startDate_endDate_idx" ON "tournaments"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_isAdmin_idx" ON "users"("isAdmin");
