"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/** Précédent / suivant en pills, la page courante entre les deux. */
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
    <nav className="v-watch-pager" aria-label="Pagination">
      <button type="button" className="v-pill" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft />
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button type="button" className="v-pill" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
        <ChevronRight />
      </button>
    </nav>
  );
}
