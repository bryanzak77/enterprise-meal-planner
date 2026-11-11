import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { Check, ChevronLeft, ChevronRight, Lock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { saveOrders } from "@/lib/lunch.functions";
import { orderBatchSchema } from "@/lib/lunch.validation";
import lunchPhoto from "@/assets/staff-lunch.jpg";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEPARTMENTS,
  cutoffFor,
  dayLabel,
  defaultOrderingMonday,
  fetchMenu,
  fetchOrders,
  fetchSettings,
  isLocked,
  shortDate,
  staffKey,
  toISO,
  weekDays,
} from "@/lib/lunch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Order Lunch — Enterprise Insurance" },
      { name: "description", content: "Pick your lunch for each day of the week at Enterprise Insurance." },
      { property: "og:title", content: "Order Lunch — Enterprise Insurance" },
      { property: "og:description", content: "Pick your lunch for each day of the week." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrderPage,
});

type Identity = { name: string; department: string };
const ID_KEY = "ei-lunch-identity";
const SKIP = "skip";

function OrderPage() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ID_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        if (typeof stored.name === "string" && DEPARTMENTS.includes(stored.department)) setIdentity(stored);
      }
    } catch { localStorage.removeItem(ID_KEY); }
    setReady(true);
  }, []);

  const save = (id: Identity) => {
    localStorage.setItem(ID_KEY, JSON.stringify(id));
    setIdentity(id);
    setEditing(false);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <img src={lunchPhoto} alt="Jollof rice, grilled chicken and fresh vegetables" width={1536} height={768} className="absolute inset-0 h-full w-full object-cover object-right" />
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-10">
          <p className="text-sm font-medium uppercase tracking-widest text-highlight">Lunch ordering</p>
          <h1 className="mt-2 max-w-md text-3xl font-semibold md:text-4xl">Enterprise Insurance<br />Staff Lunch</h1>
          <p className="mt-3 max-w-sm text-primary-foreground">{identity ? `Hi ${identity.name.split(" ")[0]}, what's for lunch?` : "Your next lunch, sorted."}</p>
        </div>
      </section>

      <main className="mx-auto -mt-8 max-w-6xl px-6 pb-20">
        {!ready ? null : !identity || editing ? (
          <IdentityForm initial={identity} onSave={save} onCancel={identity ? () => setEditing(false) : undefined} />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-5 py-3 shadow-card">
              <p className="text-sm">
                Ordering as <span className="font-semibold">{identity.name}</span>
                <span className="text-muted-foreground"> · {identity.department}</span>
              </p>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil /> Change
              </Button>
            </div>
            <WeekOrder identity={identity} />
          </>
        )}
      </main>
    </div>
  );
}

function IdentityForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Identity | null;
  onSave: (i: Identity) => void;
  onCancel?: (() => void) | undefined;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [department, setDepartment] = useState(initial?.department ?? "");
  return (
    <form
      className="mx-auto max-w-lg rounded-2xl bg-card p-8 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !department) {
          toast.error("Please enter your name and department");
          return;
        }
        onSave({ name: name.trim(), department });
      }}
    >
      <h2 className="text-xl font-semibold">Tell us who you are</h2>
      <p className="mt-1 text-sm text-muted-foreground">No account needed. We'll remember you on this device.</p>
      <div className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ama Mensah" maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label>Department</Label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select your department" /></SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <Button type="submit" className="flex-1">Continue</Button>
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}

function WeekOrder({ identity }: { identity: Identity }) {
  const qc = useQueryClient();
  const saveChoices = useServerFn(saveOrders);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(timer); }, []);
  const [monday, setMonday] = useState(() => defaultOrderingMonday());
  const days = weekDays(monday);
  const from = days[0], to = days[4];
  const key = staffKey(identity.name, identity.department);

  const settings = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const menu = useQuery({ queryKey: ["menu", from, to], queryFn: () => fetchMenu(from, to) });
  const mine = useQuery({
    queryKey: ["my-orders", key, from],
    queryFn: () => fetchOrders(from, to, key),
  });

  const [picks, setPicks] = useState<Record<string, string>>({});
  useEffect(() => {
    const p: Record<string, string> = {};
    mine.data?.forEach((o) => (p[o.order_date] = o.skipped ? SKIP : o.menu_item_id ?? SKIP));
    setPicks(p);
  }, [mine.data]);

  const cutoff = settings.data?.cutoff_hour ?? 16;
  const saved = useMemo(() => {
    const p: Record<string, string> = {};
    mine.data?.forEach((o) => (p[o.order_date] = o.skipped ? SKIP : o.menu_item_id ?? SKIP));
    return p;
  }, [mine.data]);
  const changed = days.filter((d) => !isLocked(d, cutoff, now) && picks[d] && picks[d] !== saved[d]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!changed.length) return;
    setSaving(true);
    const rows = changed.map((d) => ({
      staff_name: identity.name,
      department: identity.department,
      order_date: d,
      skipped: picks[d] === SKIP,
      menu_item_id: picks[d] === SKIP ? null : (picks[d] ?? null),
    }));
    try {
      const result = await saveChoices({ data: orderBatchSchema.parse(rows) });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(`Saved ${rows.length} day${rows.length > 1 ? "s" : ""}. Enjoy your meal!`);
      await qc.invalidateQueries({ queryKey: ["my-orders"] });
    } catch { toast.error("Couldn't save your order. Please try again."); }
    finally { setSaving(false); }
  };

  const openDays = days.filter((d) => !isLocked(d, cutoff, now));
  const fillAll = (idx: number) => {
    const p = { ...picks };
    openDays.forEach((d) => {
      const items = menu.data?.filter((m) => m.menu_date === d) ?? [];
      if (items[idx]) p[d] = items[idx].id;
    });
    setPicks(p);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonday(addDays(monday, -7))} aria-label="Previous week"><ChevronLeft /></Button>
          <h2 className="text-lg font-semibold">Week of {shortDate(from)} – {shortDate(to)}</h2>
          <Button variant="outline" size="icon" onClick={() => setMonday(addDays(monday, 7))} aria-label="Next week"><ChevronRight /></Button>
        </div>
        {openDays.length > 1 && (
          <Button variant="ghost" size="sm" onClick={() => fillAll(0)}>Pick first option for all open days</Button>
        )}
      </div>

      {(menu.isError || mine.isError || settings.isError) && <p role="alert" className="mb-4 text-destructive">Couldn't load your lunch choices. <Button variant="ghost" onClick={() => { menu.refetch(); mine.refetch(); settings.refetch(); }}>Try again</Button></p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {days.map((d) => {
          const locked = isLocked(d, cutoff, now) || !settings.data || mine.isLoading;
          const items = menu.data?.filter((m) => m.menu_date === d) ?? [];
          const tomorrow = d === toISO(addDays(new Date(), 1));
          return (
            <div key={d} className={cn("flex flex-col rounded-2xl bg-card p-4 shadow-card", locked && "opacity-70")}>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-display font-semibold">{dayLabel(d)}</p>
                  <p className="text-xs text-muted-foreground">{shortDate(d)}{tomorrow && " · Tomorrow"}</p>
                </div>
                {locked ? (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"><Lock className="size-3" />Closed</span>
                ) : saved[d] ? (
                  <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success"><Check className="size-3" />Saved</span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {menu.isLoading && <div className="h-24 animate-pulse rounded-lg bg-muted" />}
                {!menu.isLoading && items.length === 0 && <p className="text-sm text-muted-foreground">No menu yet.</p>}
                {items.map((m) => (
                  <Button variant="outline"
                    key={m.id}
                    disabled={locked}
                    onClick={() => setPicks({ ...picks, [d]: m.id })}
                    className={cn(
                      "h-auto w-full flex-col items-start whitespace-normal rounded-lg border p-3 text-left transition-all enabled:hover:border-accent disabled:cursor-not-allowed",
                      picks[d] === m.id ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-border",
                    )}
                  >
                    <p className="text-sm font-semibold leading-snug">{m.name}</p>
                    {m.description && <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>}
                    {m.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {m.tags.map((t) => <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{t}</span>)}
                      </div>
                    )}
                  </Button>
                ))}
                {items.length > 0 && (
                  <Button variant="outline"
                    disabled={locked}
                    onClick={() => setPicks({ ...picks, [d]: SKIP })}
                    className={cn(
                      "h-auto whitespace-normal rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground disabled:cursor-not-allowed",
                      picks[d] === SKIP ? "border-foreground text-foreground" : "border-border",
                    )}
                  >
                    I won't need lunch
                  </Button>
                )}
              </div>
              {!locked && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Order by {cutoffFor(d, cutoff).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-4 rounded-2xl bg-primary px-5 py-4 text-primary-foreground shadow-card">
        <p className="text-sm">
          {changed.length ? `${changed.length} day${changed.length > 1 ? "s" : ""} with unsaved changes` : "Your choices are up to date"}
        </p>
        <Button variant="secondary" className="shrink-0 bg-highlight text-primary hover:bg-highlight/90" disabled={!changed.length || saving || !settings.data || mine.isLoading || menu.isError || mine.isError} onClick={submit}>
          {saving ? "Saving…" : "Submit order"}
        </Button>
      </div>
      {mine.data && mine.data.length > 0 && <section className="mt-8 border-t border-border pt-6"><h2 className="text-lg font-semibold">My orders</h2><ul className="mt-3 divide-y divide-border">{mine.data.map((order) => <li key={order.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="font-medium">{dayLabel(order.order_date)} · {shortDate(order.order_date)}</span><span>{order.skipped ? "No lunch" : menu.data?.find((item) => item.id === order.menu_item_id)?.name ?? "Meal no longer available"}</span></li>)}</ul></section>}
    </div>
  );
}
