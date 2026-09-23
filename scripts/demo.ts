import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  auditLogs,
  budgetAccounts,
  budgetTransactions,
  disciplinaryActions,
  factionPositions,
  factions,
  leadershipTerms,
  notifications,
  roles,
  users,
} from "../src/db/schema";

/**
 * DEVELOPMENT / DEMO data — never executed automatically.
 * Triggered only by `npm run db:seed:demo` and refused when NODE_ENV=production.
 */
export async function seedDemo(db: NodePgDatabase<Record<string, unknown>>) {
  console.log("Seeding demo data (development only)…");

  const playerRole = (await db.select().from(roles).where(eq(roles.key, "player")))[0];
  const founderRole = (await db.select().from(roles).where(eq(roles.key, "site_founder")))[0];
  const chiefAdminRole = (await db.select().from(roles).where(eq(roles.key, "chief_administrator")))[0];
  if (!playerRole || !founderRole || !chiefAdminRole) throw new Error("Run `npm run db:seed` first.");

  // Demo users ---------------------------------------------------------------
  const demoUsers = [
    {
      displayName: "Vyacheslav_Gorbunov",
      nickname: "Vyacheslav_Gorbunov",
      gameId: "532",
      gameIdVerifiedAt: new Date(),
      registrationSource: "discord",
      status: "active",
      branch: "Government / Law Enforcement",
    },
    {
      displayName: "Artyom_Sokolov",
      nickname: "Artyom_Sokolov",
      gameId: "771",
      registrationSource: "vk",
      status: "active",
      branch: "Law Enforcement",
    },
    {
      displayName: "Site_Founder",
      nickname: null,
      gameId: null,
      registrationSource: "discord",
      status: "active",
      branch: null,
    },
  ];

  const createdUserIds: number[] = [];
  for (const user of demoUsers) {
    const inserted = await db
      .insert(users)
      .values(user)
      .onConflictDoNothing({ target: users.gameId })
      .returning({ id: users.id });
    if (inserted[0]) createdUserIds.push(inserted[0].id);
    else {
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.displayName, user.displayName));
      if (existing[0]) createdUserIds.push(existing[0].id);
    }
  }

  const [lead, deputy, founder] = createdUserIds;
  const lspd = (await db.select().from(factions).where(eq(factions.key, "lspd")))[0];
  const leaderPosition = lspd
    ? (await db
        .select()
        .from(factionPositions)
        .where(eq(factionPositions.factionId, lspd.id)))[0]
    : undefined;
  const deputyPosition = lspd
    ? (await db
        .select()
        .from(factionPositions)
        .where(eq(factionPositions.factionId, lspd.id)))[1]
    : undefined;

  // Demo leadership term ------------------------------------------------------
  if (lead && leaderPosition && !(await hasActiveTerm(db, lead))) {
    await db.insert(leadershipTerms).values({
      termNumber: 1,
      userId: lead,
      factionId: leaderPosition.factionId,
      positionId: leaderPosition.id,
      rank: 10,
      appointedAt: new Date().toISOString().slice(0, 10),
      appointmentReason: "Interview (demo)",
      status: "active",
      leadershipPoints: 40,
      createdBy: founder ?? null,
    });
    await db.insert(disciplinaryActions).values({
      type: "warning",
      termId: 1,
      userId: lead,
      reason: "Demo warning",
      issuedBy: founder ?? null,
    });
  }

  if (deputy && deputyPosition && !(await hasActiveTerm(db, deputy))) {
    await db.insert(leadershipTerms).values({
      termNumber: 1,
      userId: deputy,
      factionId: deputyPosition.factionId,
      positionId: deputyPosition.id,
      rank: 9,
      appointedAt: new Date().toISOString().slice(0, 10),
      appointmentReason: "Appointment by chief (demo)",
      status: "active",
      leadershipPoints: 12,
      createdBy: lead ?? null,
    });
  }

  // Admin roles ---------------------------------------------------------------
  if (founder) {
    const already = await db.select().from(roles).where(eq(roles.key, "site_founder"));
    void already;
    const { userRoles } = await import("../src/db/schema");
    await db
      .insert(userRoles)
      .values([
        { userId: founder, roleId: founderRole.id },
        ...(chiefAdminRole ? [{ userId: lead ?? founder, roleId: chiefAdminRole.id }] : []),
      ])
      .onConflictDoNothing();
  }

  // Demo budget transaction ---------------------------------------------------
  if (lspd) {
    const account = (await db.select().from(budgetAccounts).where(eq(budgetAccounts.factionId, lspd.id)))[0];
    if (account && account.balance === 0) {
      await db.insert(budgetTransactions).values({
        accountId: account.id,
        factionId: lspd.id,
        amount: 500_000,
        type: "deposit",
        balanceBefore: 0,
        balanceAfter: 500_000,
        reason: "Initial faction funding (demo)",
        actorId: founder ?? null,
      });
      await db
        .update(budgetAccounts)
        .set({ balance: 500_000 })
        .where(eq(budgetAccounts.id, account.id));
    }
  }

  // Demo notifications + audit -------------------------------------------------
  if (lead) {
    await db.insert(notifications).values({
      userId: lead,
      type: "leader_appointed",
      title: "Leader appointed",
      body: "You were appointed as Chief of Los Santos Police Department (demo).",
      link: "/users",
    }).onConflictDoNothing();
  }
  await db
    .insert(auditLogs)
    .values({
      actorId: founder ?? null,
      actorRole: "Site Founder / Developer",
      action: "DEMO_SEED",
      entityType: "system",
      targetLabel: "Demo data created",
      reason: "Development seed",
    })
    .onConflictDoNothing();

  // Demo OAuth identities are NOT created — sign in with a real Discord/VK
  // account and assign roles through Administration.
  console.log("Demo data ready. Users can be linked via real OAuth sign-in.");
}

async function hasActiveTerm(db: NodePgDatabase<Record<string, unknown>>, userId: number) {
  const terms = await db.select().from(leadershipTerms).where(eq(leadershipTerms.userId, userId));
  return terms.some((t) => t.status === "active");
}
