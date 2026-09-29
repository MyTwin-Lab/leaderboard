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

/**
 * Le menu déroulant des formulaires, sur le vocabulaire vitrine (`.v-dd*`).
 * À poser sous une racine `.vitrine` ou `.vitrine-embed`.
 */
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
    <div ref={containerRef} className={`v-dd ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="v-dd-trigger"
        data-open={open ? "true" : "false"}
        data-empty={selected ? "false" : "true"}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDown />
      </button>

      {open && (
        <div className="v-dd-menu" role="listbox">
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
                className="v-dd-option"
                data-on={isSelected ? "true" : "false"}
              >
                <span>{option.label}</span>
                {isSelected && <Check />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
