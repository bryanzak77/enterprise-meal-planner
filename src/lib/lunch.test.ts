import { describe, expect, it } from "vitest";
import { defaultOrderingMonday, isLocked, toISO, weekDays } from "./lunch";

describe("lunch rules", () => {
  it("week is Monday to Friday", () => {
    expect(weekDays(new Date(2026, 10, 9))).toEqual([
      "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13",
    ]);
  });
  it("order locks at 4pm UTC the day before", () => {
    expect(isLocked("2026-11-11", 16, new Date("2026-11-10T15:59:00Z"))).toBe(false);
    expect(isLocked("2026-11-11", 16, new Date("2026-11-10T16:00:00Z"))).toBe(true);
  });
  it("on Friday staff order for next week", () => {
    expect(toISO(defaultOrderingMonday(new Date(2026, 10, 13, 10)))).toBe("2026-11-16");
  });
});
