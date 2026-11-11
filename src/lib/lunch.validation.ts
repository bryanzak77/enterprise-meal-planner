import { z } from "zod";

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Choose a valid date");
export const rangeSchema = z.object({ from: dateSchema, to: dateSchema });
export const dishSchema = z.object({
  id: z.string().uuid().optional(),
  menu_date: dateSchema.refine((value) => [1, 2, 3, 4, 5].includes(new Date(`${value}T00:00:00Z`).getUTCDay()), "Menus are Monday to Friday"),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
});
export const orderBatchSchema = z.array(z.object({
  staff_name: z.string().trim().min(1).max(80),
  department: z.string().trim().min(1).max(80),
  order_date: dateSchema,
  skipped: z.boolean(),
  menu_item_id: z.string().uuid().nullable(),
}).refine((row) => row.skipped ? row.menu_item_id === null : row.menu_item_id !== null, "Choose a meal or opt out"))
  .min(1).max(5)
  .refine((rows) => new Set(rows.map((row) => row.order_date)).size === rows.length, "Choose once per day");