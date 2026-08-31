"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { getSettings, updateSettings } from "@/lib/api/admin"
import type { AppSettings } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { SettingsIcon, MailIcon, Settings2Icon } from "lucide-react"

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 ${
        checked ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
}

export function AdminSettings() {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => getSettings(token!),
    enabled: !!token,
  })

  const [form, setForm] = useState<Partial<AppSettings>>({})
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({})

  // Initialize form when settings load
  useState(() => {
    if (settings) {
      setForm({
        commissionPercent: settings.commissionPercent,
        holdExpiryMinutes: settings.holdExpiryMinutes,
        cancellationPolicy: settings.cancellationPolicy,
        smtpHost: settings.smtpHost ?? undefined,
        smtpPort: settings.smtpPort ?? undefined,
        smtpUser: settings.smtpUser ?? undefined,
        smtpFrom: settings.smtpFrom ?? undefined,
        maintenanceMode: settings.maintenanceMode,
      })
      setFeatureFlags(settings.featureFlags ?? {})
    }
  })

  // Sync when settings changes
  if (settings && Object.keys(form).length === 0) {
    setForm({
      commissionPercent: settings.commissionPercent,
      holdExpiryMinutes: settings.holdExpiryMinutes,
      cancellationPolicy: settings.cancellationPolicy,
      smtpHost: settings.smtpHost ?? undefined,
      smtpPort: settings.smtpPort ?? undefined,
      smtpUser: settings.smtpUser ?? undefined,
      smtpFrom: settings.smtpFrom ?? undefined,
      maintenanceMode: settings.maintenanceMode,
    })
    setFeatureFlags(settings.featureFlags ?? {})
  }

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateSettings(token!, data),
    onSuccess: (updated) => {
      qc.setQueryData(["admin-settings"], updated)
      toast.success("Paramètres enregistrés avec succès")
      setForm({})
      setFeatureFlags({})
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  })

  const handleSave = () => {
    const payload: Record<string, unknown> = {}

    if (form.commissionPercent !== undefined) payload.commissionPercent = form.commissionPercent
    if (form.holdExpiryMinutes !== undefined) payload.holdExpiryMinutes = Number(form.holdExpiryMinutes)
    if (form.cancellationPolicy !== undefined) payload.cancellationPolicy = form.cancellationPolicy
    if (form.smtpHost !== undefined) payload.smtpHost = form.smtpHost
    if (form.smtpPort !== undefined) payload.smtpPort = Number(form.smtpPort)
    if (form.smtpUser !== undefined) payload.smtpUser = form.smtpUser
    if (form.smtpFrom !== undefined) payload.smtpFrom = form.smtpFrom
    if (form.maintenanceMode !== undefined) payload.maintenanceMode = form.maintenanceMode
    if (Object.keys(featureFlags).length > 0) payload.featureFlags = featureFlags

    updateMutation.mutate(payload)
  }

  const setField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleFlag = (key: string) => {
    setFeatureFlags((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (isLoading || !settings) return <SettingsSkeleton />

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="size-5" />
            Paramètres généraux
          </CardTitle>
          <CardDescription>Configuration de la plateforme</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="commissionPercent">Commission (% / valeur)</Label>
              <Input
                id="commissionPercent"
                type="text"
                value={form.commissionPercent ?? settings.commissionPercent}
                onChange={(e) => setField("commissionPercent", e.target.value)}
                placeholder="ex: 10 ou 0.10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holdExpiryMinutes">Délai de blocage des places (minutes)</Label>
              <Input
                id="holdExpiryMinutes"
                type="number"
                value={form.holdExpiryMinutes ?? settings.holdExpiryMinutes}
                onChange={(e) => setField("holdExpiryMinutes", parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancellationPolicy">Politique d'annulation</Label>
            <textarea
              id="cancellationPolicy"
              className="w-full min-h-24 rounded-xl border border-input bg-input/30 px-3 py-2 text-sm"
              value={form.cancellationPolicy ?? settings.cancellationPolicy}
              onChange={(e) => setField("cancellationPolicy", e.target.value)}
              placeholder="Décrivez la politique d'annulation..."
            />
          </div>
        </CardContent>
      </Card>

      {/* SMTP Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailIcon className="size-5" />
            Configuration SMTP
          </CardTitle>
          <CardDescription>Paramètres serveur mail pour les notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">Hôte SMTP</Label>
              <Input
                id="smtpHost"
                type="text"
                value={form.smtpHost ?? (settings.smtpHost ?? "")}
                onChange={(e) => setField("smtpHost", e.target.value || null)}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">Port SMTP</Label>
              <Input
                id="smtpPort"
                type="number"
                value={form.smtpPort ?? (settings.smtpPort ?? "")}
                onChange={(e) => setField("smtpPort", parseInt(e.target.value) || null)}
                placeholder="587"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpUser">Utilisateur SMTP</Label>
              <Input
                id="smtpUser"
                type="text"
                value={form.smtpUser ?? (settings.smtpUser ?? "")}
                onChange={(e) => setField("smtpUser", e.target.value || null)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpFrom">Email expéditeur</Label>
              <Input
                id="smtpFrom"
                type="email"
                value={form.smtpFrom ?? (settings.smtpFrom ?? "")}
                onChange={(e) => setField("smtpFrom", e.target.value || null)}
                placeholder="noreply@camermove.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2Icon className="size-5" />
            Fonctionnalités
          </CardTitle>
          <CardDescription>Activer ou désactiver les fonctionnalités de la plateforme</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Mode maintenance</p>
              <p className="text-sm text-muted-foreground">Empêche l'accès au site pour les utilisateurs</p>
            </div>
            <Toggle
              checked={form.maintenanceMode ?? settings.maintenanceMode}
              onChange={(v) => setField("maintenanceMode", v)}
              disabled={updateMutation.isPending}
            />
          </div>
          <Separator />
          {Object.entries(featureFlags).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{key.replace(/_/g, " ")}</p>
                <p className="text-sm text-muted-foreground">Flag: {key}</p>
              </div>
              <Toggle
                checked={value}
                onChange={() => toggleFlag(key)}
                disabled={updateMutation.isPending}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
      </div>
    </div>
  )
}
