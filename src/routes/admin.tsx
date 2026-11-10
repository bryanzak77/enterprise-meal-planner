import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const tab = "border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-muted-foreground hover:text-foreground";
  const active = { className: "!border-accent !text-foreground" };
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 pt-6">
          <h1 className="text-2xl font-semibold">Administration</h1>
          <nav className="mt-4 flex gap-6">
            <Link to="/admin" className={tab} activeProps={active} activeOptions={{ exact: true }}>Dashboard</Link>
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
