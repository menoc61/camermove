"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export function CancelButton({
  visible,
  onCancel,
  invalidateKeys = [],
}: {
  visible: boolean;
  onCancel: () => Promise<unknown>;
  invalidateKeys?: string[][];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descId = useId();
  if (!visible) return null;

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onCancel();
      invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Annulation impossible");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-fit flex-col gap-1">
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        Annuler
      </Button>
      {open ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" onClick={() => !pending && setOpen(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}
            data-slot="alert-dialog-content" onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border bg-background p-4 shadow-2xl">
            <h2 id={titleId} data-slot="alert-dialog-title" className="text-sm font-medium">
              Confirmer l&apos;annulation ?
            </h2>
            <p id={descId} data-slot="alert-dialog-description" className="text-sm text-muted-foreground">
              Cette action est définitive.
            </p>
            {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" size="sm" disabled={pending} onClick={() => setOpen(false)}>
                Garder
              </Button>
              <Button variant="destructive" size="sm" disabled={pending} onClick={confirm}>
                {pending ? "Annulation…" : "Confirmer"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
