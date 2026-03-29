import * as React from "react";

import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "secondary";
}

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "default" && "bg-primary text-white hover:bg-primary/90",
        variant === "outline" && "border border-border bg-white text-neutral-900 hover:bg-neutral-50",
        variant === "ghost" && "text-neutral-700 hover:bg-white/70",
        variant === "secondary" && "bg-secondary text-white hover:bg-neutral-800",
        className
      )}
      {...props}
    />
  );
}
