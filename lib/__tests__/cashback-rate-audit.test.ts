import { describe, expect, it } from "vitest";

import {
  buildRateAuditQuery,
  describeRateAuditWindow,
  parseTransactionIds,
  rateAuditQueryKey,
  type RateAuditForm,
} from "@/lib/cashback-rate-audit";

const form = (overrides: Partial<RateAuditForm> = {}): RateAuditForm => ({
  ratePct: "4",
  fromDate: "2026-10-20",
  toDate: "2026-10-20",
  transactionIds: "",
  monthlyCapUsd: "",
  includeUsersWithDebt: false,
  ...overrides,
});

describe("parseTransactionIds", () => {
  it("accepts ids separated by lines, commas, semicolons and spaces, once each", () => {
    expect(parseTransactionIds(" a1, b2\nc3 ;a1\n\n d4 ")).toEqual([
      "a1",
      "b2",
      "c3",
      "d4",
    ]);
  });

  it("drops the card- prefix the app shows customers", () => {
    expect(
      parseTransactionIds("card-06275d99-3a15-4645-a700-27627f24988d"),
    ).toEqual(["06275d99-3a15-4645-a700-27627f24988d"]);
  });

  it("returns nothing for an empty box", () => {
    expect(parseTransactionIds("  \n ")).toEqual([]);
  });
});

describe("buildRateAuditQuery", () => {
  it("turns whole UTC days into the API's exclusive window and the percent into a fraction", () => {
    const { query, errors } = buildRateAuditQuery(
      form({
        transactionIds:
          "06275d99-3a15-4645-a700-27627f24988d\nf2a41d6c-b48b-401a-9362-efda2faac63f",
      }),
    );
    expect(errors).toEqual({});
    expect(query).toEqual({
      rate: 0.04,
      from: "2026-10-20T00:00:00.000Z",
      to: "2026-10-21T00:00:00.000Z",
      dateField: "postedAt",
      transactionIds: [
        "06275d99-3a15-4645-a700-27627f24988d",
        "f2a41d6c-b48b-401a-9362-efda2faac63f",
      ],
    });
  });

  it("leaves out what was not asked for", () => {
    const { query } = buildRateAuditQuery(form());
    expect(query).not.toHaveProperty("transactionIds");
    expect(query).not.toHaveProperty("monthlyCapUsd");
    expect(query).not.toHaveProperty("includeUsersWithDebt");
  });

  it("passes a cap override and the debt opt-in when set", () => {
    const { query } = buildRateAuditQuery(
      form({ monthlyCapUsd: "100", includeUsersWithDebt: true }),
    );
    expect(query?.monthlyCapUsd).toBe(100);
    expect(query?.includeUsersWithDebt).toBe(true);
  });

  it("rounds the fraction instead of sending float noise", () => {
    expect(buildRateAuditQuery(form({ ratePct: "4.1" })).query?.rate).toBe(
      0.041,
    );
  });

  it("refuses a missing or out-of-range rate", () => {
    expect(
      buildRateAuditQuery(form({ ratePct: "" })).errors.ratePct,
    ).toBeDefined();
    expect(
      buildRateAuditQuery(form({ ratePct: "0.01" })).errors.ratePct,
    ).toBeDefined();
    expect(
      buildRateAuditQuery(form({ ratePct: "150" })).errors.ratePct,
    ).toBeDefined();
  });

  it("refuses missing days and an end before the start", () => {
    expect(
      buildRateAuditQuery(form({ fromDate: "" })).errors.fromDate,
    ).toBeDefined();
    const backwards = buildRateAuditQuery(
      form({ fromDate: "2026-10-21", toDate: "2026-10-20" }),
    );
    expect(backwards.errors.toDate).toBeDefined();
    expect(backwards.query).toBeUndefined();
  });

  it("refuses a cap that is not a dollar amount", () => {
    expect(
      buildRateAuditQuery(form({ monthlyCapUsd: "abc" })).errors.monthlyCapUsd,
    ).toBeDefined();
    expect(
      buildRateAuditQuery(form({ monthlyCapUsd: "-1" })).errors.monthlyCapUsd,
    ).toBeDefined();
  });
});

describe("rateAuditQueryKey", () => {
  it("ignores the order the ids were pasted in", () => {
    const a = buildRateAuditQuery(form({ transactionIds: "x\ny" })).query!;
    const b = buildRateAuditQuery(form({ transactionIds: "y, x" })).query!;
    expect(rateAuditQueryKey(a)).toBe(rateAuditQueryKey(b));
  });

  it("changes when anything that changes the payout changes", () => {
    const base = rateAuditQueryKey(buildRateAuditQuery(form()).query!);
    expect(
      rateAuditQueryKey(buildRateAuditQuery(form({ ratePct: "5" })).query!),
    ).not.toBe(base);
    expect(
      rateAuditQueryKey(
        buildRateAuditQuery(form({ toDate: "2026-10-21" })).query!,
      ),
    ).not.toBe(base);
    expect(
      rateAuditQueryKey(
        buildRateAuditQuery(form({ includeUsersWithDebt: true })).query!,
      ),
    ).not.toBe(base);
  });
});

describe("describeRateAuditWindow", () => {
  it("names a single day", () => {
    expect(
      describeRateAuditWindow(
        "2026-10-20T00:00:00.000Z",
        "2026-10-21T00:00:00.000Z",
      ),
    ).toBe("20 Oct 2026");
  });

  it("names a range by its last included day", () => {
    expect(
      describeRateAuditWindow(
        "2026-10-20T00:00:00.000Z",
        "2026-10-23T00:00:00.000Z",
      ),
    ).toBe("20 Oct – 22 Oct 2026");
  });
});
