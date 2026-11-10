import { Link } from "@tanstack/react-router";
import { UtensilsCrossed } from "lucide-react";

export function SiteHeader() {
  const link =
    "rounded-md px-3 py-1.5 text-sm font-medium text-primary-foreground/75 transition-colors hover:text-primary-foreground";
  const active = { className: "bg-primary-foreground/10 text-primary-foreground" };
  return (
    <header className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-highlight text-primary">
            <UtensilsCrossed className="size-4.5" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-sm font-semibold">Enterprise Insurance</span>
            <span className="block text-xs text-primary-foreground/60">Staff Lunch</span>
          </span>
        </Link>
        <nav className="flex gap-1">
          <Link to="/" className={link} activeProps={active} activeOptions={{ exact: true }}>
            Order
          </Link>
          <Link to="/admin" className={link} activeProps={active}>
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
