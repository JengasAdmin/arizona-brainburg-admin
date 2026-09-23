import { describe, expect, it } from "vitest";
import {
  appointSchema,
  dismissSchema,
  pointsSchema,
  disciplinarySchema,
  termQuerySchema,
} from "@/server/services/leadership";

describe("appointSchema — appointment validation", () => {
  it("accepts a minimal valid appointment", () => {
    const parsed = appointSchema.safeParse({ userId: 5, positionId: 3, reason: "Approved by council" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.rank).toBe(1); // default rank
    }
  });

  it("coerces string ids from forms", () => {
    const parsed = appointSchema.safeParse({ userId: "5", positionId: "3", rank: "2", reason: "Valid reason here" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.userId).toBe(5);
      expect(parsed.data.rank).toBe(2);
    }
  });

  it("rejects missing/negative ids", () => {
    expect(appointSchema.safeParse({ userId: 0, positionId: 3, reason: "Valid reason here" }).success).toBe(false);
    expect(appointSchema.safeParse({ userId: -1, positionId: 3, reason: "Valid reason here" }).success).toBe(false);
    expect(appointSchema.safeParse({ userId: 5, positionId: -3, reason: "Valid reason here" }).success).toBe(false);
    expect(appointSchema.safeParse({ positionId: 3, reason: "Valid reason here" }).success).toBe(false);
    expect(appointSchema.safeParse({ userId: 5, reason: "Valid reason here" }).success).toBe(false);
  });

  it("requires a reason of 3–500 characters", () => {
    expect(appointSchema.safeParse({ userId: 5, positionId: 3, reason: "ab" }).success).toBe(false);
    expect(appointSchema.safeParse({ userId: 5, positionId: 3, reason: "x".repeat(501) }).success).toBe(false);
    expect(appointSchema.safeParse({ userId: 5, positionId: 3 }).success).toBe(false);
  });

  it("validates rank bounds and date format", () => {
    expect(
      appointSchema.safeParse({ userId: 5, positionId: 3, rank: 0, reason: "Valid reason here" }).success,
    ).toBe(false);
    expect(
      appointSchema.safeParse({ userId: 5, positionId: 3, rank: 1000, reason: "Valid reason here" }).success,
    ).toBe(false);
    expect(
      appointSchema.safeParse({
        userId: 5,
        positionId: 3,
        appointedAt: "2026-13-45",
        reason: "Valid reason here",
      }).success,
    ).toBe(false);
    expect(
      appointSchema.safeParse({
        userId: 5,
        positionId: 3,
        appointedAt: "2026-02-30",
        reason: "Valid reason here",
      }).success,
    ).toBe(false);
    expect(
      appointSchema.safeParse({
        userId: 5,
        positionId: 3,
        appointedAt: "2026-09-23",
        reason: "Valid reason here",
      }).success,
    ).toBe(true);
  });
});

describe("dismissSchema — dismissal validation", () => {
  it("requires a reason (dismissals are never silent)", () => {
    expect(dismissSchema.safeParse({}).success).toBe(false);
    expect(dismissSchema.safeParse({ reason: "ab" }).success).toBe(false);
    expect(dismissSchema.safeParse({ reason: "Repeated negligence" }).success).toBe(true);
  });

  it("validates the dismissal date format", () => {
    expect(dismissSchema.safeParse({ reason: "Valid reason here", dismissedAt: "23.09.2026" }).success).toBe(false);
    expect(dismissSchema.safeParse({ reason: "Valid reason here", dismissedAt: "2026-13-45" }).success).toBe(false);
    expect(dismissSchema.safeParse({ reason: "Valid reason here", dismissedAt: "2026-09-23" }).success).toBe(true);
  });
});

describe("pointsSchema — leadership points", () => {
  it("rejects a zero delta (points must change)", () => {
    expect(pointsSchema.safeParse({ delta: 0, reason: "Valid reason here" }).success).toBe(false);
  });

  it("accepts positive and negative integer deltas", () => {
    expect(pointsSchema.safeParse({ delta: 5, reason: "Exceeded the quota" }).success).toBe(true);
    expect(pointsSchema.safeParse({ delta: -3, reason: "Missed the meeting" }).success).toBe(true);
  });

  it("rejects fractional and missing deltas", () => {
    expect(pointsSchema.safeParse({ delta: 1.5, reason: "Valid reason here" }).success).toBe(false);
    expect(pointsSchema.safeParse({ reason: "Valid reason here" }).success).toBe(false);
  });

  it("requires a reason", () => {
    expect(pointsSchema.safeParse({ delta: 1, reason: "x" }).success).toBe(false);
  });
});

describe("disciplinarySchema — warnings and reprimands", () => {
  it("only allows warning or reprimand", () => {
    expect(disciplinarySchema.safeParse({ type: "warning", reason: "Late to rollcall" }).success).toBe(true);
    expect(disciplinarySchema.safeParse({ type: "reprimand", reason: "Ignored orders" }).success).toBe(true);
    expect(disciplinarySchema.safeParse({ type: "ban", reason: "Something" }).success).toBe(false);
    expect(disciplinarySchema.safeParse({ reason: "Missing type" }).success).toBe(false);
  });

  it("requires a substantive reason", () => {
    expect(disciplinarySchema.safeParse({ type: "warning", reason: "no" }).success).toBe(false);
    expect(disciplinarySchema.safeParse({ type: "warning", reason: "x".repeat(501) }).success).toBe(false);
  });
});

describe("termQuerySchema — list filters", () => {
  it("defaults pagination safely", () => {
    const parsed = termQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.pageSize).toBe(25);
    }
  });

  it("caps pageSize at 100 and rejects page < 1", () => {
    expect(termQuerySchema.safeParse({ pageSize: 1000 }).success).toBe(false);
    expect(termQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(termQuerySchema.safeParse({ page: "-5" }).success).toBe(false);
  });

  it("only accepts known statuses and kinds", () => {
    expect(termQuerySchema.safeParse({ status: "active" }).success).toBe(true);
    expect(termQuerySchema.safeParse({ status: "dismissed" }).success).toBe(true);
    expect(termQuerySchema.safeParse({ status: "deleted" }).success).toBe(false);
    expect(termQuerySchema.safeParse({ kind: "deputy" }).success).toBe(true);
    expect(termQuerySchema.safeParse({ kind: "boss" }).success).toBe(false);
  });
});
