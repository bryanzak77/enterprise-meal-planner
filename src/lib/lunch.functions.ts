import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { lunchClient } from "./lunch.server";
import { dishSchema, orderBatchSchema, rangeSchema } from "./lunch.validation";

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await lunchClient().from("settings").select("*").eq("id", 1).single();
  if (error) throw new Error("Couldn't load the cutoff time");
  return data;
});
export const getMenu = createServerFn({ method: "GET" }).inputValidator((input) => rangeSchema.parse(input)).handler(async ({ data: range }) => {
  const { data, error } = await lunchClient().from("menu_items").select("*").gte("menu_date", range.from).lte("menu_date", range.to).order("menu_date").order("name");
  if (error) throw new Error("Couldn't load the menu");
  return data;
});
export const getOrders = createServerFn({ method: "GET" }).inputValidator((input) => rangeSchema.extend({ staff_key: z.string().max(170).optional() }).parse(input)).handler(async ({ data: range }) => {
  const client = lunchClient();
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    let query = client.from("orders").select("*").gte("order_date", range.from).lte("order_date", range.to).order("order_date").order("id").range(offset, offset + 999);
    if (range.staff_key) query = query.eq("staff_key", range.staff_key);
    const { data, error } = await query;
    if (error) throw new Error("Couldn't load lunch orders");
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
});
export const saveOrders = createServerFn({ method: "POST" }).inputValidator((input) => orderBatchSchema.parse(input)).handler(async ({ data }) => {
  const { error } = await lunchClient().from("orders").upsert(data, { onConflict: "staff_key,order_date" });
  if (error) return { ok: false, message: error.message.includes("closed") ? "One of those days has closed for orders." : "Couldn't save your choices. Please try again." };
  return { ok: true, message: "Choices saved" };
});
export const saveDish = createServerFn({ method: "POST" }).inputValidator((input) => dishSchema.parse(input)).handler(async ({ data }) => {
  const { id, ...fields } = data;
  const row = id ? { ...fields, id } : fields;
  const { error } = await lunchClient().from("menu_items").upsert(row);
  if (error) throw new Error("Couldn't save this dish");
  return { ok: true };
});
export const removeDish = createServerFn({ method: "POST" }).inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input)).handler(async ({ data }) => {
  const client = lunchClient();
  const { count, error: checkError } = await client.from("orders").select("id", { count: "exact", head: true }).eq("menu_item_id", data.id);
  if (checkError || count) throw new Error("This dish has orders and cannot be removed. Edit it instead.");
  const { error } = await client.from("menu_items").delete().eq("id", data.id);
  if (error) throw new Error("Couldn't remove this dish");
  return { ok: true };
});
export const saveCutoff = createServerFn({ method: "POST" }).inputValidator((input) => z.object({ hour: z.number().int().min(0).max(23) }).parse(input)).handler(async ({ data }) => {
  const { error } = await lunchClient().from("settings").update({ cutoff_hour: data.hour }).eq("id", 1);
  if (error) throw new Error("Couldn't save the cutoff time");
  return { ok: true };
});