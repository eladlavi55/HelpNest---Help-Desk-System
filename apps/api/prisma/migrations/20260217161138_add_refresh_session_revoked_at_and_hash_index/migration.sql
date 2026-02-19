-- AlterTable
ALTER TABLE "refresh_sessions" ADD COLUMN     "revoked_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "refresh_sessions_refresh_token_hash_idx" ON "refresh_sessions"("refresh_token_hash");
