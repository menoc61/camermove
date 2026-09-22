"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { verifyTicket, type TicketVerifyResult } from "@/lib/api/events";

export function VerifyTicketCard({ token }: { token: string }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<TicketVerifyResult | null>(null);
  const verify = useMutation({
    mutationFn: () => verifyTicket(token, code.trim()),
    onSuccess: (r) => setResult(r),
    onError: () => setResult(null),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Contrôle des billets</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Code ou numéro de billet" value={code} onChange={(e) => { setCode(e.target.value); setResult(null); }} className="w-64" />
          <Button disabled={verify.isPending || !code.trim()} onClick={() => verify.mutate()}>
            {verify.isPending ? "Vérification…" : "Vérifier"}
          </Button>
        </div>
        {verify.isError && (
          <p role="alert" className="text-sm text-destructive">
            Billet introuvable ou invalide.
          </p>
        )}
        {result && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
            <Badge variant={result.valid ? "default" : "destructive"}>{result.valid ? "Valide" : "Invalide"}</Badge>
            <div>
              <p className="text-sm font-semibold">{result.label}</p>
              <p className="text-xs text-muted-foreground">{result.detail ?? "—"} · {result.holder} · ×{result.quantity}{result.category ? ` · ${result.category}` : ""}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
