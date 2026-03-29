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
    default: "bg-neutral-950 text-white",
    green: "bg-neutral-900 text-white",
    amber: "bg-neutral-200 text-neutral-900",
    blue: "bg-red-100 text-red-900",
    slate: "bg-neutral-100 text-neutral-700",
    red: "bg-red-600 text-white"
  };

  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", tones[tone], className)}>{children}</span>;
}
