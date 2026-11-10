import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { Download, Printer } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { dayLabel, fetchMenu, fetchOrders, mondayOf, shortDate, toISO, weekDays } from "@/lib/lunch";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Lunch Dashboard — Enterprise Insurance" },
      { name: "description", content: "Lunch order metrics for Enterprise Insurance administrators." },
      { property: "og:title", content: "Lunch Dashboard — Enterprise Insurance" },
      { property: "og:description", content: "Lunch order metrics for administrators." },
    ],
  }),
  component: Dashboard,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function nextWeekday(d: Date) {
  let x = addDays(d, 1);
  while (x.getDay() === 0 || x.getDay() === 6) x = addDays(x, 1);
  return x;
}

function Dashboard() {
  const tomorrow = toISO(nextWeekday(new Date()));
  const days = weekDays(mondayOf(new Date(tomorrow + "T12:00:00")));
  const trendFrom = toISO(addDays(new Date(days[0] + "T12:00:00"), -21));
  const from = days[0], to = days[4];

  const orders = useQuery({ queryKey: ["admin-orders", trendFrom, to], queryFn: () => fetchOrders(trendFrom, to) });
  const menu = useQuery({ queryKey: ["admin-menu", trendFrom, to], queryFn: () => fetchMenu(trendFrom, to) });

  const m = useMemo(() => {
    const all = orders.data ?? [];
    const items = new Map((menu.data ?? []).map((i) => [i.id, i]));
    const week = all.filter((o) => o.order_date >= from && o.order_date <= to);
    const meals = (list: typeof all) => list.filter((o) => !o.skipped && o.menu_item_id);
    const tom = all.filter((o) => o.order_date === tomorrow);
    const tomMeals = meals(tom);

    const dishCount = (list: typeof all) => {
      const c = new Map<string, number>();
      meals(list).forEach((o) => {
        const n = items.get(o.menu_item_id!)?.name ?? "Removed dish";
        c.set(n, (c.get(n) ?? 0) + 1);
      });
      return [...c.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    };

    const staff = new Set(week.map((o) => o.staff_key));
    const deptMap = new Map<string, number>();
    meals(week).forEach((o) => deptMap.set(o.department, (deptMap.get(o.department) ?? 0) + 1));

    const perDay = days.map((d) => {
      const list = week.filter((o) => o.order_date === d);
      return { day: dayLabel(d).slice(0, 3), meals: meals(list).length, skipped: list.filter((o) => o.skipped).length };
    });

    const trend = [3, 2, 1, 0].map((w) => {
      const mon = toISO(addDays(new Date(from + "T12:00:00"), -7 * w));
      const fri = toISO(addDays(new Date(mon + "T12:00:00"), 4));
      return { week: shortDate(mon), meals: meals(all.filter((o) => o.order_date >= mon && o.order_date <= fri)).length };
    });

    const weekDishes = dishCount(week);
    const tomRows = tomMeals
      .map((o) => ({ name: o.staff_name, dept: o.department, dish: items.get(o.menu_item_id!)?.name ?? "" }))
      .sort((a, b) => a.dish.localeCompare(b.dish) || a.name.localeCompare(b.name));

    return {
      tomTotal: tomMeals.length,
      tomSkipped: tom.filter((o) => o.skipped).length,
      weekTotal: meals(week).length,
      staffCount: staff.size,
      skipRate: week.length ? Math.round((week.filter((o) => o.skipped).length / week.length) * 100) : 0,
      tomDishes: dishCount(tom),
      weekDishes,
      depts: [...deptMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      perDay,
      trend,
      tomRows,
    };
  }, [orders.data, menu.data, from, to, tomorrow]);

  const exportCsv = () => {
    const lines = [["Name", "Department", "Dish"], ...m.tomRows.map((r) => [r.name, r.dept, r.dish])];
    const csv = lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `lunch-orders-${tomorrow}.csv`;
    a.click();
  };

  const loading = orders.isLoading || menu.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Next service day</p>
          <h2 className="text-xl font-semibold">{dayLabel(tomorrow)}, {shortDate(tomorrow)}</h2>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={exportCsv} disabled={!m.tomRows.length}><Download /> Export CSV</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer /> Print</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Meals for next service day" value={m.tomTotal} sub={`${m.tomSkipped} opted out`} accent />
        <Stat label="Meals this week" value={m.weekTotal} sub={`${shortDate(from)} – ${shortDate(to)}`} />
        <Stat label="Staff ordering this week" value={m.staffCount} />
        <Stat label="Opt-out rate" value={`${m.skipRate}%`} sub="of day responses this week" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Kitchen prep — next service day" className="lg:col-span-1">
          {m.tomDishes.length === 0 ? <Empty loading={loading} /> : (
            <ul className="divide-y divide-border">
              {m.tomDishes.map((d) => (
                <li key={d.name} className="flex justify-between py-2 text-sm">
                  <span>{d.name}</span><span className="font-display font-semibold">{d.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Orders per day this week" className="lg:col-span-2">
          <ChartBox>
            <BarChart data={m.perDay}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
              <Tooltip cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="meals" name="Meals" stackId="a" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="skipped" name="Opted out" stackId="a" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Most popular dishes this week" className="lg:col-span-2">
          {m.weekDishes.length === 0 ? <Empty loading={loading} /> : (
            <ChartBox height={Math.max(200, m.weekDishes.slice(0, 8).length * 36)}>
              <BarChart data={m.weekDishes.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis type="category" dataKey="name" width={170} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="count" name="Orders" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartBox>
          )}
          {m.weekDishes.length > 1 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Least popular: <span className="font-medium text-foreground">{m.weekDishes[m.weekDishes.length - 1].name}</span>
            </p>
          )}
        </Panel>
        <Panel title="Orders by department">
          {m.depts.length === 0 ? <Empty loading={loading} /> : (
            <>
              <ChartBox height={180}>
                <PieChart>
                  <Pie data={m.depts} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {m.depts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ChartBox>
              <ul className="mt-2 space-y-1 text-sm">
                {m.depts.map((d, i) => (
                  <li key={d.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{d.name}</span>
                    <span className="font-semibold">{d.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Weekly trend">
          <ChartBox height={200}>
            <BarChart data={m.trend}>
              <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} width={30} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="meals" name="Meals" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartBox>
        </Panel>
        <Panel title={`Who's eating what — ${dayLabel(tomorrow)}`} className="lg:col-span-2">
          {m.tomRows.length === 0 ? <Empty loading={loading} /> : (
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                  <tr><th className="py-2">Name</th><th>Department</th><th>Dish</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {m.tomRows.map((r, i) => (
                    <tr key={i}><td className="py-2 font-medium">{r.name}</td><td>{r.dept}</td><td>{r.dish}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: boolean }) {
  return (
    <div className={accent ? "rounded-2xl bg-hero p-5 text-primary-foreground shadow-card" : "rounded-2xl bg-card p-5 shadow-card"}>
      <p className={accent ? "text-sm text-primary-foreground/70" : "text-sm text-muted-foreground"}>{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
      {sub && <p className={accent ? "mt-1 text-xs text-primary-foreground/60" : "mt-1 text-xs text-muted-foreground"}>{sub}</p>}
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-card p-5 shadow-card ${className}`}>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function ChartBox({ children, height = 220 }: { children: React.ReactElement; height?: number }) {
  return <div style={{ height }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
}

function Empty({ loading }: { loading: boolean }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{loading ? "Loading…" : "No orders yet."}</p>;
}
