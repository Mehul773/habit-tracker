import { describe, it, expect } from "vitest";
import { istDateString, addDays, rangeDates } from "../src/lib/dates";

describe("istDateString", () => {
  it("rolls to next IST day after 18:30 UTC", () => {
    // 2026-07-15T19:00:00Z = 2026-07-16 00:30 IST
    expect(istDateString(new Date("2026-07-15T19:00:00Z"))).toBe("2026-07-16");
  });
  it("stays same IST day just before the roll", () => {
    // 2026-07-15T18:29:00Z = 2026-07-15 23:59 IST
    expect(istDateString(new Date("2026-07-15T18:29:00Z"))).toBe("2026-07-15");
  });
  it("handles midnight UTC", () => {
    // 2026-07-15T00:00:00Z = 2026-07-15 05:30 IST
    expect(istDateString(new Date("2026-07-15T00:00:00Z"))).toBe("2026-07-15");
  });
});

describe("addDays", () => {
  it("adds and subtracts across month boundary", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });
});

describe("rangeDates", () => {
  it("is inclusive on both ends", () => {
    expect(rangeDates("2026-07-14", "2026-07-16")).toEqual([
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
    ]);
  });
});
