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
          "border-red-900/90 bg-red-900 text-white shadow-[0_14px_28px_-18px_rgba(127,29,29,0.9)] hover:border-red-800 hover:bg-red-800 hover:text-white",
        variant === "outline" &&
          "border-red-900/85 bg-red-900 text-white shadow-[0_14px_28px_-18px_rgba(127,29,29,0.82)] hover:border-red-800 hover:bg-red-800 hover:text-white",
        variant === "ghost" &&
          "border-red-900/80 bg-red-900 text-white px-2.5 shadow-[0_12px_24px_-18px_rgba(127,29,29,0.82)] hover:border-red-800 hover:bg-red-800 hover:text-white",
        variant === "secondary" &&
          "border-red-900/85 bg-red-900 text-white shadow-[0_14px_28px_-18px_rgba(127,29,29,0.85)] hover:border-red-800 hover:bg-red-800/[0.96]",
        className
      )}
      {...props}
    />
  );
}
