"use client"
/**
 * Étape 2 du wizard : les 4 types de documents (registre de commerce requis,
 * autres optionnels). Chaque fichier affiche son état ✓ / ✗ / envoi en cours.
 * L'upload lui-même (présignature + PUT MinIO) est déclenché par le parent.
 */
import { AlertCircle, Check, Loader2 } from "lucide-react"
import type { DocumentType } from "../../lib/api/partner"
import { ACCEPT, DOC_TYPES, type DocInfo } from "./form-core"

export function DocumentsStep({
  docs,
  onFile,
}: {
  docs: Record<DocumentType, DocInfo>
  onFile: (type: DocumentType, file: File | null) => void
}) {
  return (
    <div className="space-y-3">
      {DOC_TYPES.map(({ type, label, required }) => (
        <div key={type} className="rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">{label}{required ? " *" : ""}</span>
            <span className="flex min-w-0 items-center gap-1 text-xs">
              {docs[type].status === "uploading" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}
              {docs[type].status === "done" && (
                <>
                  <Check className="h-4 w-4 shrink-0 text-green-600" />
                  <span className="truncate text-green-700">{docs[type].name}</span>
                </>
              )}
              {docs[type].status === "error" && (
                <>
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span className="truncate text-red-600">Fichier invalide ou échec d&apos;envoi</span>
                </>
              )}
            </span>
          </div>
          <input
            type="file"
            accept={ACCEPT}
            disabled={docs[type].status === "uploading"}
            className="mt-2 w-full text-sm"
            aria-label={`Document : ${label}`}
            onChange={(e) => {
              onFile(type, e.target.files?.[0] ?? null)
              e.target.value = ""
            }}
          />
          <p className="mt-1 text-xs text-slate-400">PDF, JPG ou PNG · 10 Mo maximum</p>
        </div>
      ))}
    </div>
  )
}
