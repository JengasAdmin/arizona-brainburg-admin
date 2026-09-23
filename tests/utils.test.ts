import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatDateTime, formatMoney, formatSignedMoney, formatUserId, plural, cn } from "@/lib/utils";
import { formatAuditSentence } from "@/lib/audit-format";
import { rateLimit, RATE_LIMITS } from "@/server/security/rate-limit";

describe("date & money formatting", () => {
  it("formatDate renders dd.mm.yyyy", () => {
    expect(formatDate(new Date(2026, 8, 23))).toBe("23.09.2026");
    expect(formatDate(new Date(2026, 0, 5))).toBe("05.01.2026");
  });

  it("formatDate falls back to an em dash for null/invalid", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not a date")).toBe("—");
  });

  it("formatDateTime appends HH:MM", () => {
    expect(formatDateTime(new Date(2026, 8, 23, 14, 35))).toBe("23.09.2026 14:35");
    expect(formatDateTime(null)).toBe("—");
  });

  it("formatMoney uses $ thousands separators", () => {
    expect(formatMoney(15_000_000)).toBe("$15,000,000");
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(-2500)).toBe("-$2,500");
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(NaN)).toBe("—");
  });

  it("formatSignedMoney always shows a sign", () => {
    expect(formatSignedMoney(500)).toBe("+$500");
    expect(formatSignedMoney(-500)).toBe("-$500");
    expect(formatSignedMoney(0)).toBe("+$0");
  });

  it("formatUserId renders #N", () => {
    expect(formatUserId(124)).toBe("#124");
  });

  it("plural picks the right word", () => {
    expect(plural(1, "term", "terms")).toBe("1 term");
    expect(plural(0, "term", "terms")).toBe("0 terms");
    expect(plural(7, "term", "terms")).toBe("7 terms");
  });

  it("cn merges tailwind classes and resolves conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false && "text-lg", "font-bold")).toBe("text-sm font-bold");
  });
});

describe("formatAuditSentence", () => {
  it("formats known actions", () => {
    expect(
      formatAuditSentence({
        actorName: "Ivan Petrov",
        actorRole: "Chief Administrator",
        action: "APPOINT_LEADER",
        targetLabel: "Alexei — Chief of LSPD",
        reason: null,
      }),
    ).toBe("Chief Administrator Ivan Petrov appointed Alexei — Chief of LSPD.");

    expect(
      formatAuditSentence({
        actorName: "Ivan Petrov",
        actorRole: null,
        action: "BUDGET_WITHDRAWAL",
        targetLabel: "LSPD",
        reason: null,
      }),
    ).toBe("Ivan Petrov withdrew funds from LSPD.");
  });

  it("falls back to System when there is no actor", () => {
    expect(
      formatAuditSentence({ actorName: null, actorRole: null, action: "LOGOUT", targetLabel: null, reason: null }),
    ).toBe("System signed out.");
    expect(
      formatAuditSentence({ actorName: null, actorRole: null, action: "UPDATE_SETTING", targetLabel: "x", reason: null }),
    ).toBe("System changed the setting x.");
  });

  it("falls back to a generic sentence for unknown actions", () => {
    expect(
      formatAuditSentence({
        actorName: "Admin",
        actorRole: null,
        action: "SOMETHING_NEW",
        targetLabel: "X",
        reason: null,
      }),
    ).toBe("Admin performed SOMETHING_NEW on X.");
  });
});

describe("rate limiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit, then blocks with a retry hint", () => {
    const result1 = rateLimit("unit-test-a", 3, 60_000);
    expect(result1.ok).toBe(true);
    expect(result1.remaining).toBe(2);

    rateLimit("unit-test-a", 3, 60_000);
    const result3 = rateLimit("unit-test-a", 3, 60_000);
    expect(result3.ok).toBe(true);

    const result4 = rateLimit("unit-test-a", 3, 60_000);
    expect(result4.ok).toBe(false);
    expect(result4.retryAfterSec).toBeGreaterThan(0);
    expect(result4.remaining).toBe(0);
  });

  it("tracks keys independently", () => {
    expect(rateLimit("unit-test-b", 1, 60_000).ok).toBe(true);
    expect(rateLimit("unit-test-b", 1, 60_000).ok).toBe(false);
    expect(rateLimit("unit-test-c", 1, 60_000).ok).toBe(true);
  });

  it("frees the window after it elapses", () => {
    vi.useFakeTimers();
    expect(rateLimit("unit-test-d", 1, 60_000).ok).toBe(true);
    expect(rateLimit("unit-test-d", 1, 60_000).ok).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(rateLimit("unit-test-d", 1, 60_000).ok).toBe(true);
  });

  it("exposes sane production defaults", () => {
    expect(RATE_LIMITS.write.limit).toBeGreaterThan(0);
    expect(RATE_LIMITS.read.limit).toBeGreaterThanOrEqual(RATE_LIMITS.write.limit);
    expect(RATE_LIMITS.authSensitive.limit).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS.oauthCallback.windowMs).toBeGreaterThan(0);
  });
});
