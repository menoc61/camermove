"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clampPage } from "./lib";

export { clampPage, shouldShowPagination } from "./lib";

export function PaginationControls({
  page,
  totalPages,
  isFetching = false,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  isFetching?: boolean;
  onPageChange: (next: number) => void;
}) {
  if (totalPages <= 1) return null;
  const current = clampPage(page, totalPages);
  const canPrev = current > 1;
  const canNext = current < totalPages;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 pt-2">
      <div data-slot="pagination" className="flex w-full items-center justify-between gap-2">
        <div data-slot="pagination-content" className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" aria-label="Page précédente"
            disabled={!canPrev || isFetching} onClick={() => onPageChange(current - 1)}>
            <ChevronLeft data-icon="inline-start" /> Précédent
          </Button>
        </div>
        <span data-slot="pagination-link" aria-live="polite" aria-current="page"
          className="text-xs text-muted-foreground">
          Page {current} / {totalPages}
        </span>
        <div data-slot="pagination-content" className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" aria-label="Page suivante"
            disabled={!canNext || isFetching} onClick={() => onPageChange(current + 1)}>
            Suivant <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
