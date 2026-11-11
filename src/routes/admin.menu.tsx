import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { addDays } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dayLabel, defaultOrderingMonday, fetchMenu, fetchSettings, shortDate, weekDays, type MenuItem } from "@/lib/lunch";
import { removeDish, saveCutoff, saveDish } from "@/lib/lunch.functions";
import { dishSchema } from "@/lib/lunch.validation";

export const Route = createFileRoute("/admin/menu")({
  head: () => ({ meta: [
    { title: "Weekly Menu & Cutoff — Enterprise Insurance" },
    { name: "description", content: "Manage the Monday-to-Friday staff lunch menu and ordering cutoff." },
    { property: "og:title", content: "Weekly Menu & Cutoff — Enterprise Insurance" },
    { property: "og:description", content: "Manage lunch dishes and ordering deadlines." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: MenuPage,
});

type Draft = { id?: string; menu_date: string; name: string; description: string; tags: string };
function MenuPage() {
  const qc = useQueryClient();
  const save = useServerFn(saveDish), remove = useServerFn(removeDish), cutoffSave = useServerFn(saveCutoff);
  const [monday, setMonday] = useState(() => defaultOrderingMonday());
  const days = weekDays(monday);
  const menu = useQuery({ queryKey: ["admin-menu", days[0], days[4]], queryFn: () => fetchMenu(days[0], days[4]) });
  const settings = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const [hour, setHour] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-menu"] }); qc.invalidateQueries({ queryKey: ["menu"] }); };
  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try { await work(); toast.success(success); return true; } catch (e) { toast.error(e instanceof Error ? e.message : "Please try again"); return false; } finally { setBusy(false); }
  };
  const saveDraft = async () => {
    if (!draft) return;
    const result = dishSchema.safeParse({ ...draft, tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean) });
    if (!result.success) { toast.error(result.error.issues[0]?.message ?? "Check the dish details"); return; }
    if (await run(() => save({ data: result.data }), "Dish saved")) { setDraft(null); refresh(); }
  };
  return <div className="space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Weekly menu</h2><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Previous menu week" onClick={() => setMonday(addDays(monday, -7))}><ChevronLeft /></Button><span className="text-sm font-medium">{shortDate(days[0])} – {shortDate(days[4])}</span><Button variant="outline" size="icon" aria-label="Next menu week" onClick={() => setMonday(addDays(monday, 7))}><ChevronRight /></Button></div></div>
    <form className="flex flex-wrap items-end gap-4 border-y border-border py-5" onSubmit={async (e) => { e.preventDefault(); if (await run(() => cutoffSave({ data: { hour: Number(hour ?? settings.data?.cutoff_hour ?? 16) } }), "Cutoff updated")) qc.invalidateQueries({ queryKey: ["settings"] }); }}>
      <div className="mr-auto"><h3 className="flex items-center gap-2 font-semibold"><Clock className="size-4" />Order cutoff</h3><p className="mt-1 text-sm text-muted-foreground">Previous day · UTC</p></div>
      <div className="space-y-2"><Label>Cutoff time</Label><Select value={hour ?? String(settings.data?.cutoff_hour ?? 16)} onValueChange={setHour}><SelectTrigger className="w-40" aria-label="Cutoff time"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 24 }, (_, i) => <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00 UTC</SelectItem>)}</SelectContent></Select></div><Button disabled={busy || !settings.data} type="submit"><Save />Save cutoff</Button>
    </form>
    {settings.isError && <p role="alert" className="text-destructive">Couldn't load cutoff settings.</p>}
    {menu.isError ? <p role="alert" className="text-destructive">Couldn't load the menu. <Button variant="ghost" onClick={() => menu.refetch()}>Try again</Button></p> : menu.isLoading ? <p className="py-10 text-muted-foreground">Loading menu…</p> : <div className="divide-y divide-border">{days.map((day) => <section key={day} className="grid gap-4 py-5 md:grid-cols-[160px_1fr]"><div><h3 className="font-semibold">{dayLabel(day)}</h3><p className="text-sm text-muted-foreground">{shortDate(day)}</p><Button variant="ghost" size="sm" className="mt-3" onClick={() => setDraft({ menu_date: day, name: "", description: "", tags: "" })}><Plus />Add dish</Button></div><div className="space-y-3">{!menu.data?.some((i) => i.menu_date === day) && <p className="py-3 text-sm text-muted-foreground">No dishes scheduled.</p>}{menu.data?.filter((i) => i.menu_date === day).map((item) => <article key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4"><div className="min-w-0"><h4 className="font-semibold">{item.name}</h4><p className="mt-1 text-sm text-muted-foreground">{item.description}</p><div className="mt-2 flex flex-wrap gap-2">{item.tags.map((tag) => <span key={tag} className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{tag}</span>)}</div></div><div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" title="Edit dish" aria-label={`Edit ${item.name}`} onClick={() => setDraft({ ...item, tags: item.tags.join(", ") })}><Pencil /></Button><Button variant="ghost" size="icon" title="Remove dish" aria-label={`Remove ${item.name}`} onClick={() => setDeleting(item)}><Trash2 className="text-destructive" /></Button></div></article>)}</div></section>)}</div>}
    <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open && !busy) setDraft(null); }}><DialogContent><DialogHeader><DialogTitle>{draft?.id ? "Edit dish" : "Add dish"} · {draft ? dayLabel(draft.menu_date) : ""}</DialogTitle></DialogHeader>{draft && <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveDraft(); }}><div className="space-y-2"><Label htmlFor="dish-name">Dish name</Label><Input id="dish-name" required maxLength={120} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="dish-description">Description</Label><Textarea id="dish-description" maxLength={500} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="dish-tags">Dietary & allergen tags</Label><Input id="dish-tags" placeholder="vegetarian, fish, contains nuts" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} /></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setDraft(null)}>Cancel</Button><Button type="submit" disabled={busy}><Save />{busy ? "Saving…" : "Save dish"}</Button></div></form>}</DialogContent></Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Remove {deleting?.name}?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Dishes with existing orders cannot be removed.</p><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={async () => { if (deleting && await run(() => remove({ data: { id: deleting.id } }), "Dish removed")) { setDeleting(null); refresh(); } }}><Trash2 />Remove dish</Button></div></DialogContent></Dialog>
  </div>;
}