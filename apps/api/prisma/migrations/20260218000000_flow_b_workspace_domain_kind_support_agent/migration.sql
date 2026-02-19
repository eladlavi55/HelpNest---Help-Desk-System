-- CreateEnum
CREATE TYPE "WorkspaceKind" AS ENUM ('CUSTOMER', 'SUPPORT_OPS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "is_support_agent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "domain" TEXT,
ADD COLUMN "kind" "WorkspaceKind" NOT NULL DEFAULT 'CUSTOMER';

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_domain_key" ON "Workspace"("domain");
