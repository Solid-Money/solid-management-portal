import { describe, expect, it } from "vitest";

import {
  balanceOnCardsToClose,
  bucketLabel,
  cardsKeptOpen,
  cardsToClose,
  confirmPhrase,
  isRunActive,
  isRunWorking,
  itemResultLabel,
  itemsToCsv,
  phraseMatches,
  runProgress,
} from "@/lib/rain-sunset-bulk-cancel";
import type {
  RainSunsetBulkCancelItem,
  RainSunsetBulkCancelRun,
} from "@/types";

const run = (
  overrides: Partial<RainSunsetBulkCancelRun> = {},
): RainSunsetBulkCancelRun => ({
  id: "6ac4df9322b1a60a4458ab81",
  status: "ready",
  mode: null,
  maxBalanceUsd: 1,
  createdBy: "ops@fuse.io",
  createdAt: "2026-11-24T10:00:00.000Z",
  previewFinishedAt: "2026-11-24T10:12:00.000Z",
  previewExpiresAt: "2026-11-25T10:12:00.000Z",
  confirmedBy: null,
  confirmedAt: null,
  stoppedBy: null,
  stoppedAt: null,
  finishedAt: null,
  preview: {
    cards: 2234,
    users: 2233,
    read: 2234,
    low: { cards: 1900, balanceUsd: 120.456 },
    high: { cards: 300, balanceUsd: 45000.1 },
    unknown: { cards: 34 },
    migrationStarted: 82,
    accountDeleted: 12,
  },
  execution: null,
  ...overrides,
});

const item = (
  overrides: Partial<RainSunsetBulkCancelItem> = {},
): RainSunsetBulkCancelItem => ({
  cardId: "card-1",
  userId: "6ac4df9322b1a60a4458ab80",
  username: "ada",
  email: "ada@example.com",
  country: "KE",
  accountDeleted: false,
  migrationStarted: false,
  cardStatus: "active",
  cardCreatedAt: null,
  bucket: "low",
  balanceUsd: 0.4,
  totalCollateralUsd: 0.4,
  spendingPowerUsd: 0.4,
  balanceError: null,
  outcome: null,
  outcomeBalanceUsd: null,
  outcomeError: null,
  processedAt: null,
  ...overrides,
});

describe("what a mode closes", () => {
  it("closes every previewed card in 'all' mode", () => {
    expect(cardsToClose(run(), "all")).toBe(2234);
    expect(cardsKeptOpen(run(), "all")).toBe(0);
    expect(balanceOnCardsToClose(run(), "all")).toBe(45120.56);
  });

  it("closes only the $1-or-less cards in low-balance mode, keeping the rest", () => {
    expect(cardsToClose(run(), "low_balance")).toBe(1900);
    // Over $1 and unreadable both stay open.
    expect(cardsKeptOpen(run(), "low_balance")).toBe(334);
    expect(balanceOnCardsToClose(run(), "low_balance")).toBe(120.46);
  });
});

describe("run state", () => {
  it("polls while working and holds the slot while ready", () => {
    expect(isRunWorking("previewing")).toBe(true);
    expect(isRunWorking("cancelling")).toBe(true);
    expect(isRunWorking("ready")).toBe(false);
    expect(isRunActive("ready")).toBe(true);
    expect(isRunActive("completed")).toBe(false);
    expect(isRunActive("stopped")).toBe(false);
    expect(isRunActive("discarded")).toBe(false);
  });

  it("reports progress on balances read, then on cards processed", () => {
    expect(
      runProgress(
        run({
          status: "previewing",
          preview: { ...run().preview, read: 1117 },
        }),
      ),
    ).toBe(50);
    expect(
      runProgress(
        run({
          status: "cancelling",
          mode: "low_balance",
          execution: {
            selected: 1900,
            processed: 475,
            cancelled: 470,
            alreadyCancelled: 0,
            skippedBalance: 5,
            skippedUnreadable: 0,
            skippedNotHeld: 0,
            failed: 0,
            notProcessed: 1425,
          },
        }),
      ),
    ).toBe(25);
    expect(
      runProgress(run({ status: "previewing", preview: { ...run().preview, cards: 0, read: 0 } })),
    ).toBe(100);
  });
});

describe("the typed confirmation", () => {
  it("names the count, so it cannot confirm the other mode", () => {
    expect(confirmPhrase(1900)).toBe("CLOSE 1900");
    expect(phraseMatches(" close 1900 ", 1900)).toBe(true);
    expect(phraseMatches("CLOSE 2234", 1900)).toBe(false);
    expect(phraseMatches("CLOSE", 1900)).toBe(false);
  });
});

describe("labels", () => {
  it("names balance groups against the run's limit", () => {
    expect(bucketLabel("low", 1)).toBe("≤ $1.00");
    expect(bucketLabel("high", 1)).toBe("> $1.00");
    expect(bucketLabel("unknown")).toBe("Unreadable");
    expect(bucketLabel(null)).toBe("Reading…");
  });

  it("explains why a confirmed run did not close a card", () => {
    const confirmed = { status: "cancelling" as const, mode: "low_balance" as const };
    expect(itemResultLabel(item({ outcome: "cancelled" }), confirmed)).toBe("Closed");
    expect(itemResultLabel(item({ bucket: "high" }), confirmed)).toBe(
      "Kept open (not selected)",
    );
    expect(itemResultLabel(item(), confirmed)).toBe("Waiting");
    expect(itemResultLabel(item(), { status: "stopped", mode: "all" })).toBe(
      "Not reached",
    );
    expect(itemResultLabel(item(), { status: "ready", mode: null })).toBeNull();
  });
});

describe("itemsToCsv", () => {
  it("writes one row per card, quoting and neutralising what it must", () => {
    const csv = itemsToCsv(
      [
        item({ username: '=HYPERLINK("x")', email: "a,b@example.com" }),
        item({ cardId: "card-2", bucket: "high", balanceUsd: 12.5, outcome: "skipped_balance" }),
      ],
      run({ status: "completed", mode: "low_balance" }),
    );
    const [header, first, second] = csv.split("\n");
    expect(header.split(",")[0]).toBe("userId");
    expect(first).toContain(`"'=HYPERLINK(""x"")"`);
    expect(first).toContain('"a,b@example.com"');
    expect(first).toContain("≤ $1.00");
    expect(first).toContain("Not reached");
    expect(second).toContain("card-2");
    expect(second).toContain("Kept: holds more than $1");
  });
});
