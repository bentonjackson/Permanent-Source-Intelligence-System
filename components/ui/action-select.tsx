"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export function ActionSelect({
  placeholder = "Actions",
  options,
  onSelect,
  className
}: {
  placeholder?: string;
  options: Array<{ label: string; value: string; disabled?: boolean }>;
  onSelect: (value: string) => void | Promise<void>;
  className?: string;
}) {
  const [value, setValue] = useState("");

  return (
    <select
      aria-label={placeholder}
      className={cn(
        "h-9 rounded-md border px-3 text-[11px] font-semibold uppercase tracking-[0.16em]",
        className
      )}
      style={{ borderColor: "var(--field-border)", background: "var(--field-bg)", color: "var(--title-strong)" }}
      value={value}
      onChange={async (event) => {
        const nextValue = event.target.value;
        setValue(nextValue);

        if (!nextValue) {
          return;
        }

        await onSelect(nextValue);
        setValue("");
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
