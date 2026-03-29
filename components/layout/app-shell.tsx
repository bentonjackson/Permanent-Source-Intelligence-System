"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ListTodo, Database, PhoneCall, Archive } from "lucide-react";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Plot Queue", icon: ListTodo },
  { href: "/contacted", label: "Contacted", icon: PhoneCall },
  { href: "/closed-jobs", label: "Awarded / Declined", icon: Archive },
  { href: "/builders", label: "Builders", icon: Building2 },
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
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-[28px] border bg-slate-950 px-5 py-6 text-slate-50 shadow-panel">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.24em] text-red-300">Eastern Iowa</p>
            <h1 className="mt-3 text-2xl font-semibold leading-tight">Permanent Source Intelligence System</h1>
            <p className="mt-3 text-sm text-neutral-300">
              Find empty lots and early new-build opportunities before builders lock in insulation bids.
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
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors",
                    active ? "bg-white text-neutral-950" : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
            <p className="font-medium">Rep workflow</p>
            <p className="mt-1 text-red-100/80">Start in Plot Queue, find the builder, and ask for the insulation bid early.</p>
          </div>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
