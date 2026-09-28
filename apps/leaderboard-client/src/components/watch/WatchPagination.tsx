"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

const BUTTON_CLASS =
  "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export function WatchPagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange(page: number): void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
      <button type="button" className={BUTTON_CLASS} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-3.5 w-3.5" />
        Previous
      </button>
      <span className="text-xs text-white/40">
        Page {page} of {totalPages}
      </span>
      <button type="button" className={BUTTON_CLASS} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </nav>
  );
}
