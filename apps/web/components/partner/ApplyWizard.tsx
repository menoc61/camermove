"use client"
/**
 * ApplyWizard — formulaire en 3 étapes « Devenir partenaire transporteur ».
 * Étape 1 : infos entreprise · Étape 2 : documents (présignature puis PUT
 * direct vers MinIO via DocumentsStep) · Étape 3 : récapitulatif + envoi,
 * puis carte de statut via GET /partner-applications/me.
 */
import { useState } from "react"
import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import {
  getMyApplication,
  presignDocument,
  submitApplication,
  uploadToPresigned,
  type DocumentType,
  type MyApplication,
} from "../../lib/api/partner"
import { DocumentsStep } from "./DocumentsStep"
import {
  DOC_TYPES,
  EMPTY_DOCS,
  EMPTY_FORM,
  Field,
  MAX_DOC_BYTES,
  MIME_OK,
  STATUS_LABELS,
  validateCompany,
  type FormState,
} from "./form-core"

export function ApplyWizard({ token }: { token: string }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [docs, setDocs] = useState(EMPTY_DOCS)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [details, setDetails] = useState<MyApplication | null>(null)

  const uploaded = DOC_TYPES.filter(({ type }) => docs[type].status === "done")
  const inputCls = (bad?: string) => `mt-1 w-full rounded border px-3 py-2 text-sm ${bad ? "border-red-400" : ""}`

  function update(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
    setFeedback(null)
  }

  /** Sélection → présignature → PUT direct MinIO ; état ✓/✗ par fichier. */
  async function handleFile(type: DocumentType, file: File | null) {
    setFeedback(null)
    if (!file) return
    if (!MIME_OK.includes(file.type) || file.size < 1 || file.size > MAX_DOC_BYTES) {
      setDocs((d) => ({ ...d, [type]: { status: "error", name: file.name } }))
      return
    }
    setDocs((d) => ({ ...d, [type]: { status: "uploading", name: file.name } }))
    try {
      const { objectKey, uploadUrl } = await presignDocument(token, { type, mimetype: file.type, size: file.size })
      await uploadToPresigned(uploadUrl, file)
      setDocs((d) => ({ ...d, [type]: { status: "done", name: file.name, objectKey, mimetype: file.type, size: file.size } }))
    } catch {
      setDocs((d) => ({ ...d, [type]: { status: "error", name: file.name } }))
    }
  }

  function next() {
    if (step === 1) {
      const e = validateCompany(form)
      setErrors(e)
      if (Object.values(e).some(Boolean)) return
      setStep(2)
    } else if (step === 2) {
      if (docs.business_registration.status !== "done") return setFeedback("Le registre de commerce est obligatoire.")
      if (uploaded.length < 1) return setFeedback("Ajoutez au moins un document.")
      setStep(3)
    }
  }

  async function submit() {
    setSubmitting(true)
    setFeedback(null)
    try {
      await submitApplication(token, {
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim(),
        phone: form.phone.trim(),
        ...(form.city.trim() && { city: form.city.trim() }),
        ...(form.transportType.trim() && { transportType: form.transportType.trim() }),
        ...(form.vehicleCount.trim() && { vehicleCount: Number(form.vehicleCount.trim()) }),
        routesServed: form.routesServed.split(",").map((r) => r.trim()).filter(Boolean),
        ...(form.message.trim() && { message: form.message.trim() }),
        documents: uploaded.map(({ type }) => ({
          type, objectKey: docs[type].objectKey!, mimetype: docs[type].mimetype!, size: docs[type].size!,
        })),
      })
      try {
        setDetails(await getMyApplication(token))
      } catch {
        // Statut détaillé indisponible : la carte générique reste affichée.
      }
      setSent(true)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Échec de l'envoi de la demande.")
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    const routes = form.routesServed.split(",").map((r) => r.trim()).filter(Boolean)
    return (
      <div className="space-y-4 rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-green-600" />
          <p className="font-medium">Votre demande a bien été envoyée</p>
        </div>
        <div className="space-y-1 text-sm text-slate-600">
          <p>Statut : <span className="font-semibold text-[#0e9f8f]">{STATUS_LABELS[details?.status ?? "received"] ?? details?.status ?? "Reçue"}</span></p>
          <p>Entreprise : {details?.companyName ?? form.companyName}</p>
          {details?.createdAt && <p>Déposée le {new Date(details.createdAt).toLocaleDateString("fr-FR")}</p>}
          {routes.length > 0 && <p>Routes desservies : {routes.join(", ")}</p>}
          {details?.documents && <p>{details.documents.length} document(s) transmis.</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ol className="flex items-center gap-4 text-xs text-slate-500">
        {["Entreprise", "Documents", "Récapitulatif"].map((label, i) => (
          <li key={label} className={step === i + 1 ? "font-semibold text-[#0e9f8f]" : ""}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {feedback && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{feedback}</div>}

      {step === 1 && (
        <div className="space-y-3 rounded-xl border p-3">
          <Field label="Nom de l'entreprise *" error={errors.companyName}>
            <input className={inputCls(errors.companyName)} placeholder="ex: Transports Unis SARL" value={form.companyName} onChange={(e) => update("companyName", e.target.value)} aria-invalid={!!errors.companyName} />
          </Field>
          <Field label="Nom du contact *" error={errors.contactName}>
            <input className={inputCls(errors.contactName)} placeholder="ex: Jean Mbarga" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} aria-invalid={!!errors.contactName} />
          </Field>
          <Field label="Téléphone *" error={errors.phone}>
            <input className={inputCls(errors.phone)} placeholder="+2376XXXXXXXX" value={form.phone} onChange={(e) => update("phone", e.target.value)} aria-invalid={!!errors.phone} />
          </Field>
          <Field label="Ville" error={errors.city}>
            <input className={inputCls(errors.city)} placeholder="ex: Douala" value={form.city} onChange={(e) => update("city", e.target.value)} aria-invalid={!!errors.city} />
          </Field>
          <Field label="Type de transport" error={errors.transportType}>
            <input className={inputCls(errors.transportType)} placeholder="ex: interurbain, frêt, tourisme" value={form.transportType} onChange={(e) => update("transportType", e.target.value)} aria-invalid={!!errors.transportType} />
          </Field>
          <Field label="Nombre de véhicules" error={errors.vehicleCount}>
            <input className={inputCls(errors.vehicleCount)} inputMode="numeric" placeholder="ex: 12" value={form.vehicleCount} onChange={(e) => update("vehicleCount", e.target.value)} aria-invalid={!!errors.vehicleCount} />
          </Field>
          <Field label="Routes desservies (séparées par des virgules)" error={errors.routesServed}>
            <input className={inputCls(errors.routesServed)} placeholder="ex: Douala-Yaoundé, Bafoussam-Dschang" value={form.routesServed} onChange={(e) => update("routesServed", e.target.value)} aria-invalid={!!errors.routesServed} />
          </Field>
          <Field label="Message (optionnel)" error={errors.message}>
            <textarea rows={3} className={inputCls(errors.message)} placeholder="Présentez votre activité…" value={form.message} onChange={(e) => update("message", e.target.value)} aria-invalid={!!errors.message} />
          </Field>
        </div>
      )}

      {step === 2 && <DocumentsStep docs={docs} onFile={(t, f) => void handleFile(t, f)} />}

      {step === 3 && (
        <div className="space-y-2 rounded-xl border p-3 text-sm">
          <p><span className="text-slate-500">Entreprise :</span> {form.companyName}</p>
          <p><span className="text-slate-500">Contact :</span> {form.contactName} · {form.phone}</p>
          {form.city && <p><span className="text-slate-500">Ville :</span> {form.city}</p>}
          {form.transportType && <p><span className="text-slate-500">Type de transport :</span> {form.transportType}</p>}
          {form.vehicleCount && <p><span className="text-slate-500">Véhicules :</span> {form.vehicleCount}</p>}
          {form.routesServed && (
            <p><span className="text-slate-500">Routes desservies :</span> {form.routesServed.split(",").map((r) => r.trim()).filter(Boolean).join(", ") || "—"}</p>
          )}
          {form.message && <p><span className="text-slate-500">Message :</span> {form.message}</p>}
          <div>
            <p className="text-slate-500">Documents :</p>
            <ul className="list-disc pl-5">
              {uploaded.map(({ type, label }) => (
                <li key={type}>{label} — {docs[type].name} ({Math.round((docs[type].size ?? 0) / 1024)} Ko)</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setStep(step - 1)} disabled={step === 1} className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">
          <ChevronLeft className="mr-1 inline h-4 w-4" />Retour
        </button>
        {step < 3 ? (
          <button type="button" onClick={next} className="rounded-lg bg-[#0e9f8f] px-3 py-1.5 text-sm font-medium text-white">
            Continuer<ChevronRight className="ml-1 inline h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={() => void submit()} disabled={submitting} className="rounded-lg bg-[#0e9f8f] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {submitting ? "Envoi…" : "Envoyer la demande"}
          </button>
        )}
      </div>
    </div>
  )
}
