import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEPARTMENTS, dayLabel, defaultOrderingMonday, fetchMenu, fetchOrders, shortDate, weekDays } from "@/lib/lunch";
import { downloadCsv } from "@/lib/export";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [
    { title: "All Lunch Orders — Enterprise Insurance" },
    { name: "description", content: "Review staff lunch choices by date, department and meal." },
    { property: "og:title", content: "All Lunch Orders — Enterprise Insurance" },
    { property: "og:description", content: "Staff lunch choices and kitchen order exports." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: OrdersPage,
});

function OrdersPage() {
  const initial = weekDays(defaultOrderingMonday());
  const [from, setFrom] = useState(initial[0]);
  const [to, setTo] = useState(initial[4]);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const valid = Boolean(from && to && from <= to);
  const orders = useQuery({ queryKey: ["admin-orders", from, to], queryFn: () => fetchOrders(from, to), enabled: valid });
  const menu = useQuery({ queryKey: ["admin-menu", from, to], queryFn: () => fetchMenu(from, to), enabled: valid });
  const rows = useMemo(() => {
    const dishes = new Map(menu.data?.map((item) => [item.id, item.name]));
    return (orders.data ?? []).map((order) => ({ ...order, dish: order.skipped ? "Opted out" : dishes.get(order.menu_item_id ?? "") ?? "Removed dish" }))
      .filter((row) => (dept === "all" || row.department === dept) && (status === "all" || row.skipped === (status === "skip")) && `${row.staff_name} ${row.department} ${row.dish}`.toLowerCase().includes(search.toLowerCase()));
  }, [orders.data, menu.data, dept, status, search]);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">All orders</h2><p className="mt-1 text-sm text-muted-foreground">{rows.length} responses · {rows.filter((row) => !row.skipped).length} meals</p></div>
      <div className="flex gap-2 print:hidden"><Button variant="outline" disabled={!rows.length} onClick={() => downloadCsv(`lunch-orders-${from}-${to}.csv`, [["Date", "Name", "Department", "Dish", "Status"], ...rows.map((row) => [row.order_date, row.staff_name, row.department, row.dish, row.skipped ? "Opted out" : "Meal"])])}><Download />Export CSV</Button><Button variant="outline" onClick={() => window.print()}><Printer />Print</Button></div>
    </div>
    <div className="grid items-end gap-4 border-y border-border py-5 sm:grid-cols-2 lg:grid-cols-5 print:hidden">
      <div className="space-y-2"><Label htmlFor="orders-from">From</Label><Input id="orders-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="orders-to">To</Label><Input id="orders-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <div className="space-y-2"><Label>Department</Label><Select value={dept} onValueChange={setDept}><SelectTrigger className="w-full" aria-label="Filter department"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All departments</SelectItem>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full" aria-label="Filter status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All responses</SelectItem><SelectItem value="meal">Meals</SelectItem><SelectItem value="skip">Opted out</SelectItem></SelectContent></Select></div>
      <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" aria-label="Search orders" placeholder="Search orders" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
    </div>
    {!valid ? <p role="alert">Choose an end date on or after the start date.</p> : orders.isError || menu.isError ? <p role="alert" className="text-destructive">Couldn't load orders. <Button variant="ghost" onClick={() => { orders.refetch(); menu.refetch(); }}>Try again</Button></p> : orders.isLoading || menu.isLoading ? <p className="py-10 text-muted-foreground">Loading orders…</p> : !rows.length ? <p className="py-10 text-center text-muted-foreground">No orders match these filters.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="py-3 pr-4">Day</th><th className="pr-4">Staff member</th><th className="pr-4">Department</th><th>Lunch choice</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.id}><td className="whitespace-nowrap py-4 pr-4">{dayLabel(row.order_date)}<span className="block text-xs text-muted-foreground">{shortDate(row.order_date)}</span></td><td className="pr-4 font-medium">{row.staff_name}</td><td className="pr-4">{row.department}</td><td className={row.skipped ? "text-muted-foreground" : ""}>{row.dish}</td></tr>)}</tbody></table></div>}
  </div>;
}