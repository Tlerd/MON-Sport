-- Brief F-038: OAuth for MCP (BR-60). Expand only.
-- CreateTable
CREATE TABLE "OAuthRequest" (
    "id" UUID NOT NULL,
    "clientId" VARCHAR(500) NOT NULL,
    "clientName" VARCHAR(100) NOT NULL,
    "redirectUri" VARCHAR(500) NOT NULL,
    "codeChallenge" CHAR(43) NOT NULL,
    "scope" VARCHAR(100) NOT NULL,
    "state" VARCHAR(500),
    "resource" VARCHAR(500) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "userId" UUID,
    "grantedScope" VARCHAR(100),
    "codeHash" CHAR(64),
    "codeExpiresAt" TIMESTAMPTZ(3),
    "codeUsedAt" TIMESTAMPTZ(3),
    "deniedAt" TIMESTAMPTZ(3),
    "connectionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthConnection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "clientId" VARCHAR(500) NOT NULL,
    "clientName" VARCHAR(100) NOT NULL,
    "scope" "AccessTokenScope" NOT NULL,
    "accessTokenHash" CHAR(64) NOT NULL,
    "accessExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "refreshTokenHash" CHAR(64),
    "previousRefreshTokenHash" CHAR(64),
    "refreshRotatedAt" TIMESTAMPTZ(3),
    "refreshExpiresAt" TIMESTAMPTZ(3),
    "lastUsedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthRequest_codeHash_key" ON "OAuthRequest"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthRequest_connectionId_key" ON "OAuthRequest"("connectionId");

-- CreateIndex
CREATE INDEX "OAuthRequest_expiresAt_idx" ON "OAuthRequest"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthConnection_accessTokenHash_key" ON "OAuthConnection"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthConnection_refreshTokenHash_key" ON "OAuthConnection"("refreshTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthConnection_previousRefreshTokenHash_key" ON "OAuthConnection"("previousRefreshTokenHash");

-- CreateIndex
CREATE INDEX "OAuthConnection_userId_idx" ON "OAuthConnection"("userId");

-- AddForeignKey
ALTER TABLE "OAuthRequest" ADD CONSTRAINT "OAuthRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConnection" ADD CONSTRAINT "OAuthConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
