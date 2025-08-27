-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "totalRounds" INTEGER NOT NULL,
    "roundDurationDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tournament_players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "joinedRound" INTEGER NOT NULL DEFAULT 1,
    "comodinesUsed" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "tournament_players_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tournament_players_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rounds_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    CONSTRAINT "groups_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "group_players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "points" REAL NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "usedComodin" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "group_players_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_players_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "team1Player1Id" TEXT NOT NULL,
    "team1Player2Id" TEXT NOT NULL,
    "team2Player1Id" TEXT NOT NULL,
    "team2Player2Id" TEXT NOT NULL,
    "team1Games" INTEGER,
    "team2Games" INTEGER,
    "tiebreakScore" TEXT,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "reportedById" TEXT,
    "confirmedById" TEXT,
    "photoUrl" TEXT,
    CONSTRAINT "matches_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "games" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "points" REAL NOT NULL,
    "isWinner" BOOLEAN NOT NULL,
    CONSTRAINT "match_results_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rankings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "totalPoints" REAL NOT NULL,
    "roundsPlayed" INTEGER NOT NULL,
    "averagePoints" REAL NOT NULL,
    "position" INTEGER NOT NULL,
    "ironmanPosition" INTEGER NOT NULL,
    "movement" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "players_userId_key" ON "players"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_players_tournamentId_playerId_key" ON "tournament_players"("tournamentId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_tournamentId_number_key" ON "rounds"("tournamentId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "groups_roundId_number_key" ON "groups"("roundId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "group_players_groupId_playerId_key" ON "group_players"("groupId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "group_players_groupId_position_key" ON "group_players"("groupId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "matches_groupId_setNumber_key" ON "matches"("groupId", "setNumber");

-- CreateIndex
CREATE UNIQUE INDEX "match_results_matchId_playerId_key" ON "match_results"("matchId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "rankings_tournamentId_playerId_roundNumber_key" ON "rankings"("tournamentId", "playerId", "roundNumber");