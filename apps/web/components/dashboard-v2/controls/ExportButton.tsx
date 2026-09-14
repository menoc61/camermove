"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { buildExportQuery, parseExportFilename, type ExportFormat } from "./lib";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type { ExportFormat };
export { buildExportQuery, parseExportFilename };

export async function triggerExportDownload(o: {
  endpoint: string;
  token: string;
  resource: string;
  dateFrom: string;
  dateTo: string;
  format: ExportFormat;
}) {
  const qs = buildExportQuery(o);
  const res = await fetch(`${o.endpoint}?${qs}`, {
    headers: { Authorization: `Bearer ${o.token}` },
  });
  if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const fallback = `export-${o.resource}-${o.dateFrom || "all"}-${o.dateTo || "all"}.${o.format}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = parseExportFilename(res.headers.get("Content-Disposition") ?? "", fallback);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportButton({ token, endpoint, resource }: { token?: string; endpoint?: string; resource: string }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const disabled = !token || !endpoint;

  async function onExport() {
    if (invalid || busy || !token || !endpoint) return;
    setBusy(true);
    setError(null);
    try {
      await triggerExportDownload({ endpoint, token, resource, dateFrom, dateTo, format });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" size="sm" aria-expanded={open} aria-controls="export-popover" onClick={() => setOpen((v) => !v)} disabled={disabled}>
        <Download data-icon="inline-start" /> Exporter
      </Button>
      {open ? (
        <div id="export-popover" data-slot="popover" className="flex flex-col gap-3 rounded-2xl border bg-popover p-3 shadow-2xl">
          <FieldGroup>
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="exp-from">Du</FieldLabel>
              <Input id="exp-from" type="date" value={dateFrom} aria-invalid={invalid || undefined} onChange={(e) => setDateFrom(e.target.value)} disabled={disabled} />
            </Field>
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="exp-to">Au</FieldLabel>
              <Input id="exp-to" type="date" value={dateTo} aria-invalid={invalid || undefined} onChange={(e) => setDateTo(e.target.value)} disabled={disabled} />
            </Field>
            {invalid ? <FieldError>La date de fin précède la date de début.</FieldError> : null}
          </FieldGroup>
          <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)} disabled={disabled}>
            <SelectTrigger aria-label="Format d'export" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup><SelectItem value="csv">CSV</SelectItem><SelectItem value="json">JSON</SelectItem></SelectGroup></SelectContent>
          </Select>
          <Button size="sm" onClick={onExport} disabled={busy || invalid || disabled}>{busy ? "Export…" : "Télécharger"}</Button>
          {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
