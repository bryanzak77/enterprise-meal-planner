import { describe, expect, it } from "vitest";
import { dishSchema, orderBatchSchema } from "./lunch.validation";

const row = { staff_name: "Bryan", department: "IT", order_date: "2026-11-16", skipped: false, menu_item_id: "00000000-0000-4000-8000-000000000001" };
describe("weekly lunch choices", () => {
  it("accepts all five weekday choices together", () => {
    expect(orderBatchSchema.parse([16,17,18,19,20].map((day) => ({ ...row, order_date: `2026-11-${day}` })))).toHaveLength(5);
  });
  it("accepts a skip without a meal", () => {
    expect(orderBatchSchema.safeParse([{ ...row, skipped: true, menu_item_id: null }]).success).toBe(true);
    expect(orderBatchSchema.safeParse([{ ...row, skipped: true }]).success).toBe(false);
  });
  it("allows only one choice per day", () => {
    expect(orderBatchSchema.safeParse([row, row]).success).toBe(false);
  });
  it("only schedules dishes Monday to Friday", () => {
    expect(dishSchema.safeParse({ menu_date: "2026-11-21", name: "Rice", description: "", tags: [] }).success).toBe(false);
    expect(dishSchema.safeParse({ menu_date: "2026-11-16", name: "Rice", description: "", tags: [] }).success).toBe(true);
  });
});