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
      <div className="mx-auto grid min-h-screen max-w-[1480px] grid-cols-1 gap-4 px-3 py-3 lg:grid-cols-[232px_1fr]">
        <aside className="rounded-[24px] border bg-slate-950 px-4 py-5 text-slate-50 shadow-panel">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.24em] text-red-300">BuildSignal</p>
            <h1 className="mt-3 text-[1.6rem] font-semibold leading-tight text-white">BuildSignal</h1>
            <p className="mt-2 text-sm text-red-200">First-to-bid construction signals for Eastern Iowa.</p>
            <p className="mt-3 text-sm text-neutral-300">
              Spot early lots, find the real builder contact, and get insulation and shelving in front of them before competitors do.
            </p>
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
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                    active ? "bg-white text-neutral-950" : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-100">
            <p className="font-medium">Rep workflow</p>
            <p className="mt-1 text-red-100/80">Start in Plot Queue, drill into Builders when needed, and get the insulation bid in early.</p>
          </div>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
