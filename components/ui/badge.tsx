import { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "default",
  children
}: {
  className?: string;
  tone?: "default" | "green" | "amber" | "blue" | "slate" | "red";
  children: ReactNode;
}) {
  const tones = {
    default: "border-white/14 bg-white/[0.05] text-white/86",
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    amber: "border-amber-300/18 bg-amber-200/10 text-amber-100",
    blue: "border-red-400/22 bg-red-500/10 text-red-100",
    slate: "border-white/10 bg-white/[0.035] text-white/62",
    red: "border-red-500/32 bg-red-500/16 text-red-50"
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.22em]",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
