/**
 * Idempotent seed script for multi-tenant support demo.
 *
 * RBAC (membership-based, single source of truth):
 * - Support agent = WorkspaceMember in Support Ops with role ADMIN
 * - Members = WorkspaceMember in CUSTOMER workspace
 *
 * SEED CREDENTIALS (for dev/testing):
 * ─────────────────────────────────────────
 * | User                | Password   | Role          | Workspace   |
 * | admin@demo.local    | Admin123!  | Support Agent | Support Ops |
 * | member@demo.local   | Member123! | Member        | demo.local  |
 * | member2@example.com | Member123! | Member        | example.com |
 *
 * Expected: admin can access /app/admin/*; members cannot.
 */

import { PrismaClient, WorkspaceRole, WorkspaceKind, TicketPriority } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SUPPORT_OPS_NAME = "Support Ops";
const ADMIN_EMAIL = "admin@demo.local";
const MEMBER_EMAIL = "member@demo.local";
const MEMBER2_EMAIL = "member2@example.com";
const ADMIN_PASSWORD = "Admin123!";
const MEMBER_PASSWORD = "Member123!";

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

async function main() {
  console.log("🌱 Seeding database (Flow B)...");

  const adminHash = hashPassword(ADMIN_PASSWORD);
  const memberHash = hashPassword(MEMBER_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: adminHash, isSupportAgent: true },
    create: {
      email: ADMIN_EMAIL,
      passwordHash: adminHash,
      isSupportAgent: true,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: MEMBER_EMAIL },
    update: { passwordHash: memberHash },
    create: {
      email: MEMBER_EMAIL,
      passwordHash: memberHash,
    },
  });

  let supportOps = await prisma.workspace.findFirst({
    where: { kind: WorkspaceKind.SUPPORT_OPS },
  });
  if (!supportOps) {
    supportOps = await prisma.workspace.create({
      data: {
        name: SUPPORT_OPS_NAME,
        kind: WorkspaceKind.SUPPORT_OPS,
        domain: null,
      },
    });
  }

  let demoWorkspace = await prisma.workspace.findUnique({
    where: { domain: "demo.local" },
  });
  if (!demoWorkspace) {
    demoWorkspace = await prisma.workspace.create({
      data: {
        name: "demo.local",
        domain: "demo.local",
        kind: WorkspaceKind.CUSTOMER,
      },
    });
  }

  let exampleWorkspace = await prisma.workspace.findUnique({
    where: { domain: "example.com" },
  });
  if (!exampleWorkspace) {
    exampleWorkspace = await prisma.workspace.create({
      data: {
        name: "example.com",
        domain: "example.com",
        kind: WorkspaceKind.CUSTOMER,
      },
    });
  }

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: supportOps.id, userId: admin.id },
    },
    update: { role: WorkspaceRole.ADMIN },
    create: {
      workspaceId: supportOps.id,
      userId: admin.id,
      role: WorkspaceRole.ADMIN,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: demoWorkspace.id, userId: member.id },
    },
    update: { role: WorkspaceRole.MEMBER },
    create: {
      workspaceId: demoWorkspace.id,
      userId: member.id,
      role: WorkspaceRole.MEMBER,
    },
  });

  const member2 = await prisma.user.upsert({
    where: { email: MEMBER2_EMAIL },
    update: { passwordHash: memberHash },
    create: {
      email: MEMBER2_EMAIL,
      passwordHash: memberHash,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: exampleWorkspace.id, userId: member2.id },
    },
    update: { role: WorkspaceRole.MEMBER },
    create: {
      workspaceId: exampleWorkspace.id,
      userId: member2.id,
      role: WorkspaceRole.MEMBER,
    },
  });

  const seedTitles = [
    "Welcome to Support",
    "Sample Issue",
    "Billing Question",
    "Feature Request: Dark Mode",
  ];

  await prisma.ticketMessage.deleteMany({
    where: { ticket: { workspaceId: demoWorkspace.id, title: { in: seedTitles } } },
  });
  await prisma.ticket.deleteMany({
    where: { workspaceId: demoWorkspace.id, title: { in: seedTitles } },
  });

  const ticket1 = await prisma.ticket.create({
    data: {
      workspaceId: demoWorkspace.id,
      createdByUserId: member.id,
      title: "Welcome to Support",
      status: "OPEN",
      priority: null, // NONE
      category: "general",
      messages: { create: { authorId: member.id, content: "Hello! This is a sample ticket." } },
    },
  });

  const ticket2 = await prisma.ticket.create({
    data: {
      workspaceId: demoWorkspace.id,
      createdByUserId: member.id,
      title: "Sample Issue",
      status: "PENDING",
      priority: TicketPriority.LOW,
      category: "auth",
      messages: { create: { authorId: member.id, content: "I'm having trouble logging in." } },
    },
  });

  const ticket3 = await prisma.ticket.create({
    data: {
      workspaceId: demoWorkspace.id,
      createdByUserId: member.id,
      title: "Billing Question",
      status: "OPEN",
      priority: TicketPriority.HIGH,
      category: "billing",
      messages: { create: { authorId: member.id, content: "Why was I charged twice this month?" } },
    },
  });

  const ticket4 = await prisma.ticket.create({
    data: {
      workspaceId: demoWorkspace.id,
      createdByUserId: member.id,
      title: "Feature Request: Dark Mode",
      status: "RESOLVED",
      priority: TicketPriority.MEDIUM,
      category: "general",
      messages: { create: { authorId: member.id, content: "Please add a dark mode option." } },
    },
  });

  console.log("✅ Seed completed successfully.");
  console.log("");
  console.log("SEED CREDENTIALS (for dev/testing):");
  console.log("─────────────────────────────────");
  console.log("  Support agent:", ADMIN_EMAIL, "/", ADMIN_PASSWORD);
  console.log("  Member (demo.local):", MEMBER_EMAIL, "/", MEMBER_PASSWORD);
  console.log("  Member (example.com):", MEMBER2_EMAIL, "/", MEMBER_PASSWORD);
  console.log("─────────────────────────────────");
  console.log("  Support Ops workspace:", supportOps.id);
  console.log("  demo.local workspace:", demoWorkspace.id);
  console.log("  example.com workspace:", exampleWorkspace.id);
  console.log("  Sample tickets:", ticket1.id, ",", ticket2.id, ",", ticket3.id, ",", ticket4.id);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
