import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// The approved no-password model intentionally uses public RLS permissions,
// never a privileged client. Cutoff and meal validity are enforced by triggers.
export function lunchClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Lunch service is unavailable");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
}