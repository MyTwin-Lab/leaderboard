"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SelectDropdown({
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
  className = "",
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={[
          "flex w-full items-center justify-between gap-2 rounded-xl border bg-white/5 py-2.5 pl-3 pr-2.5 text-sm transition-all duration-150",
          "border-white/10 focus:outline-none",
          open
            ? "border-brandCP/50 shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
            : "hover:border-white/20 hover:bg-white/8",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        ].join(" ")}
        style={{ color: "var(--foreground)" }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "" : "opacity-40"}>{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 opacity-40 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--foreground)" }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-white/10 shadow-xl animate-slide-in"
          style={{ background: "var(--background)" }}
          role="listbox"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center justify-between px-3 py-2 text-sm transition-colors duration-100",
                  isSelected
                    ? "text-brandCP"
                    : "hover:bg-white/[0.06]",
                ].join(" ")}
                style={{ color: isSelected ? "var(--theme-primary)" : "var(--foreground)" }}
              >
                <span>{option.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--theme-primary)" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
