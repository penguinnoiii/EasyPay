-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tokenAmount" TEXT NOT NULL,
    "thbSatang" INTEGER NOT NULL,
    "feeBps" INTEGER NOT NULL,
    "feeSatang" INTEGER NOT NULL,
    "merchantId" TEXT NOT NULL,
    "merchantName" TEXT,
    "rateUsed" REAL NOT NULL,
    "expiry" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUOTED',
    "txHash" TEXT,
    "payoutRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_authId_key" ON "User"("authId");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_quoteId_key" ON "Payment"("quoteId");
