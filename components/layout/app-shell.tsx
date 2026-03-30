"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ListTodo, Database, PhoneCall, Archive } from "lucide-react";

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

  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 gap-4 px-3 py-3 lg:grid-cols-[260px_1fr] lg:px-4 lg:py-4">
        <aside className="surface-panel panel-grid rounded-[22px] px-4 py-5 text-white lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <div className="mb-6 border-b border-white/10 pb-5">
            <p className="eyebrow-label text-red-200/70">BuildSignal</p>
            <h1 className="mt-3 font-serif text-[2rem] leading-none tracking-[-0.05em] text-white">BuildSignal</h1>
            <p className="mt-3 text-[11px] uppercase tracking-[0.28em] text-red-200/76">Cedar Rapids Corridor</p>
            <p className="mt-4 text-sm leading-6 text-white/58">
              Spot early lots, find the real builder contact, and get insulation and shelving in front of them before competitors do.
            </p>
          </div>
          <div className="mb-3 flex items-center justify-between">
            <p className="engraved-label">Workspace</p>
            <div className="h-px flex-1 bg-white/8 ml-4" />
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
                      ? "border-red-500/35 bg-red-500/10 text-white shadow-[inset_0_0_0_1px_rgba(196,59,53,0.12)]"
                      : "border-white/8 bg-white/[0.02] text-white/58 hover:border-white/14 hover:bg-white/[0.05] hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("h-4 w-4", active ? "text-red-200" : "text-white/42 group-hover:text-white/72")} />
                    <span className="text-[12px] font-semibold uppercase tracking-[0.2em]">{item.label}</span>
                  </div>
                  <div className={cn("h-px w-6", active ? "bg-red-400/70" : "bg-white/10")} />
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
            <p className="eyebrow-label text-red-200/70">Rep Workflow</p>
            <p className="mt-3 font-serif text-lg leading-tight text-white">Queue. Contact. Close.</p>
            <p className="mt-2 text-sm leading-6 text-white/56">Start in Plot Queue, step into the builder record when needed, and move only the leads that are ready to work.</p>
          </div>
        </aside>
        <main className="pb-6">{children}</main>
      </div>
    </div>
  );
}
