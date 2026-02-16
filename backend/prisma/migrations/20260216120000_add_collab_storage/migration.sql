-- CreateTable
CREATE TABLE "CollabRoom" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollabRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollabSceneSnapshot" (
    "roomId" TEXT NOT NULL,
    "sceneVersion" INTEGER NOT NULL,
    "iv" BYTEA NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollabSceneSnapshot_pkey" PRIMARY KEY ("roomId")
);

-- CreateTable
CREATE TABLE "CollabAsset" (
    "roomId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "blob" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollabAsset_pkey" PRIMARY KEY ("roomId","fileId")
);

-- CreateIndex
CREATE INDEX "CollabRoom_lastActivityAt_idx" ON "CollabRoom"("lastActivityAt");

-- CreateIndex
CREATE INDEX "CollabAsset_updatedAt_idx" ON "CollabAsset"("updatedAt");

-- AddForeignKey
ALTER TABLE "CollabSceneSnapshot" ADD CONSTRAINT "CollabSceneSnapshot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "CollabRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollabAsset" ADD CONSTRAINT "CollabAsset_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "CollabRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
