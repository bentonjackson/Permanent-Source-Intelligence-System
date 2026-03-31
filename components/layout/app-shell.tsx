"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, ListTodo, Database, PhoneCall, Archive, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Plot Queue", icon: ListTodo },
  { href: "/builders", label: "Builders", icon: Building2 },
  { href: "/contacted", label: "Contacted", icon: PhoneCall },
  { href: "/closed-jobs", label: "Closed", icon: Archive },
  { href: "/sources", label: "Sources", icon: Database }
];

export function AppShell({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === "light" || current === "dark") {
      setTheme(current);
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("buildsignal-theme", next);
    } catch {}
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 gap-4 px-3 py-3 lg:grid-cols-[260px_1fr] lg:px-4 lg:py-4">
        <aside className="surface-panel panel-grid rounded-[22px] px-4 py-5 text-white lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <div className="mb-6 border-b border-[color:var(--line-subtle)] pb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow-label">BuildSignal</p>
                <h1 className="mt-3 font-serif text-[2rem] leading-none tracking-[-0.05em] text-[color:var(--title-strong)]">BuildSignal</h1>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--line-strong)] bg-[color:var(--panel-muted)] text-[color:var(--title-strong)] transition-colors duration-200 hover:bg-[color:var(--panel-hover)]"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.28em] text-[color:var(--brand-accent-soft)]">Cedar Rapids Corridor</p>
            <p className="mt-4 text-sm leading-6 text-[color:var(--text-soft)]">
              Spot early lots, find the real builder contact, and get insulation and shelving in front of them before competitors do.
            </p>
          </div>
          <div className="mb-3 flex items-center justify-between">
            <p className="engraved-label">Workspace</p>
            <div className="ml-4 h-px flex-1 bg-[color:var(--line-subtle)]" />
          </div>
          <nav className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active =
                pathname.startsWith(item.href) ||
                (item.href === "/dashboard" && pathname.startsWith("/opportunities")) ||
                (item.href === "/contacted" && pathname.startsWith("/contacted")) ||
                (item.href === "/closed-jobs" && pathname.startsWith("/closed-jobs"));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center justify-between gap-3 rounded-[14px] border px-3 py-3 transition-all duration-200",
                    active
                      ? "border-red-400/42 bg-red-500/[0.12] text-[color:var(--title-strong)] shadow-[inset_0_0_0_1px_rgba(196,59,53,0.2),0_14px_28px_-24px_rgba(196,59,53,0.8)]"
                      : "border-[color:var(--brand-accent-faint)] bg-[color:var(--panel-muted)] text-[color:var(--text-soft)] hover:border-red-400/18 hover:bg-[color:var(--panel-hover)] hover:text-[color:var(--title-strong)]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("h-4 w-4", active ? "text-red-100" : "text-[color:var(--text-faint)] group-hover:text-red-200")} />
                    <span className="text-[12px] font-semibold uppercase tracking-[0.2em]">{item.label}</span>
                  </div>
                  <div className={cn("h-px w-6", active ? "bg-red-300/80" : "bg-red-400/16")} />
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 rounded-[16px] border border-red-400/14 bg-red-500/[0.06] p-4">
            <p className="eyebrow-label">Rep Workflow</p>
            <p className="mt-3 font-serif text-lg leading-tight text-[color:var(--title-strong)]">Queue. Contact. Close.</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-soft)]">Start in Plot Queue, step into the builder record when needed, and move only the leads that are ready to work.</p>
          </div>
        </aside>
        <main className="pb-6">{children}</main>
      </div>
    </div>
  );
}
