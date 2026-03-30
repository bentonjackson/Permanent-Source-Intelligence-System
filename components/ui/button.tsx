import * as React from "react";

import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "secondary";
}

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "default" &&
          "border-red-500/38 bg-red-500/10 text-red-100 hover:border-red-400/60 hover:bg-red-500/16 hover:text-white",
        variant === "outline" &&
          "border-white/12 bg-white/[0.03] text-white/82 hover:border-white/22 hover:bg-white/[0.06] hover:text-white",
        variant === "ghost" && "border-transparent bg-transparent px-2.5 text-white/60 hover:bg-white/[0.04] hover:text-white",
        variant === "secondary" && "border-white/10 bg-white/[0.08] text-white hover:bg-white/[0.12]",
        className
      )}
      {...props}
    />
  );
}
