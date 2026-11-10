import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export const DEPARTMENTS = [
  "Claims",
  "Underwriting",
  "Finance",
  "Human Resources",
  "IT",
  "Sales & Marketing",
  "Customer Service",
  "Legal & Compliance",
  "Executive Office",
];

export type MenuItem = {
  id: string;
  menu_date: string;
  name: string;
  description: string;
  tags: string[];
};

export type Order = {
  id: string;
  staff_name: string;
  department: string;
  order_date: string;
  menu_item_id: string | null;
  skipped: boolean;
  staff_key: string;
  created_at: string;
  updated_at: string;
};

export const toISO = (d: Date) => format(d, "yyyy-MM-dd");

/** Monday-to-Friday ISO dates for the week starting on `monday`. */
export function weekDays(monday: Date): [string, string, string, string, string] {
  const d = (i: number) => toISO(addDays(monday, i));
  return [d(0), d(1), d(2), d(3), d(4)];
}

export function mondayOf(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 });
}

/** The week staff should be ordering for: the week of the next weekday after today. */
export function defaultOrderingMonday(now = new Date()): Date {
  let d = addDays(now, 1);
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  return mondayOf(d);
}

/** Orders for a date lock at `cutoffHour` (UTC) on the previous day. */
export function cutoffFor(dateISO: string, cutoffHour: number): Date {
  const d = parseISO(dateISO + "T00:00:00Z");
  return new Date(d.getTime() - 24 * 3600 * 1000 + cutoffHour * 3600 * 1000);
}

export function isLocked(dateISO: string, cutoffHour: number, now = new Date()): boolean {
  return now.getTime() >= cutoffFor(dateISO, cutoffHour).getTime();
}

export const staffKey = (name: string, dept: string) =>
  `${name.trim().toLowerCase()}|${dept.toLowerCase()}`;

export async function fetchSettings() {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function fetchMenu(from: string, to: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .gte("menu_date", from)
    .lte("menu_date", to)
    .order("menu_date")
    .order("name");
  if (error) throw error;
  return data as MenuItem[];
}

export async function fetchOrders(from: string, to: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .gte("order_date", from)
    .lte("order_date", to)
    .order("order_date")
    .limit(5000);
  if (error) throw error;
  return data as Order[];
}

export const dayLabel = (iso: string) => format(parseISO(iso), "EEEE");
export const shortDate = (iso: string) => format(parseISO(iso), "d MMM");
