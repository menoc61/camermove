"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { listTransporters, listPartnerApplications, reviewPartnerApplication } from "@/lib/api/admin"
import type { TransporterItem, PartnerApplicationItem } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { SearchIcon, CheckCircleIcon, XCircleIcon } from "lucide-react"

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR")

const appStatusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive" as any,
}

const transporterStatusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  inactive: "secondary",
  suspended: "destructive",
}

function TransporterRowSkeleton() {
  return (
    <TableRow>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableCell key={i}><Skeleton className="h-4 w-20" /></TableCell>
      ))}
    </TableRow>
  )
}

function ApplicationRowSkeleton() {
  return (
    <TableRow>
      {Array.from({ length: 9 }).map((_, i) => (
        <TableCell key={i}><Skeleton className="h-4 w-20" /></TableCell>
      ))}
    </TableRow>
  )
}

export function AdminTransporters() {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()

  const [search, setSearch] = useState("")
  const [reviewTarget, setReviewTarget] = useState<PartnerApplicationItem | null>(null)
  const [reviewStatus, setReviewStatus] = useState<"approved" | "rejected">("approved")
  const [reviewMessage, setReviewMessage] = useState("")

  const { data: transportersData, isLoading: transportersLoading } = useQuery({
    queryKey: ["admin-transporters", search],
    queryFn: () => listTransporters(token!, { q: search, limit: "50" }),
    enabled: !!token,
  })

  const { data: applicationsData, isLoading: applicationsLoading } = useQuery({
    queryKey: ["admin-partner-applications"],
    queryFn: () => listPartnerApplications(token!, { status: "pending", limit: "50" }),
    enabled: !!token,
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: string; message?: string } }) =>
      reviewPartnerApplication(token!, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-partner-applications"] })
      qc.invalidateQueries({ queryKey: ["admin-transporters"] })
      qc.invalidateQueries({ queryKey: ["admin-stats"] })
      toast.success("Candidature examinée avec succès")
      setReviewTarget(null)
    },
    onError: () => toast.error("Erreur lors de l'examen"),
  })

  return (
    <div className="space-y-4">
      <Tabs defaultValue="transporters">
        <TabsList>
          <TabsTrigger value="transporters">Transporteurs approuvés</TabsTrigger>
          <TabsTrigger value="applications">
            Candidatures en attente
            {applicationsData?.items.length ? ` (${applicationsData.items.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transporters" className="mt-4 space-y-4">
          <div className="relative max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher transporteur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Véhicules</TableHead>
                  <TableHead>Trajets</TableHead>
                  <TableHead>Créé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transportersLoading && Array.from({ length: 5 }).map((_, i) => <TransporterRowSkeleton key={i} />)}
                {!transportersLoading && transportersData?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Aucun transporteur trouvé.
                    </TableCell>
                  </TableRow>
                )}
                {!transportersLoading && transportersData?.items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.companyName}</TableCell>
                    <TableCell>{t.email}</TableCell>
                    <TableCell>{t.city ?? "—"}</TableCell>
                    <TableCell>{t.transportType ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={transporterStatusVariant[t.status] ?? "outline"}>{t.status}</Badge>
                    </TableCell>
                    <TableCell>{t._count.vehicles}</TableCell>
                    <TableCell>{t._count.trips}</TableCell>
                    <TableCell>{fmtDate(t.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="applications" className="mt-4 space-y-4">
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Tél.</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Véhicules</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applicationsLoading && Array.from({ length: 5 }).map((_, i) => <ApplicationRowSkeleton key={i} />)}
                {!applicationsLoading && applicationsData?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Aucune candidature en attente.
                    </TableCell>
                  </TableRow>
                )}
                {!applicationsLoading && applicationsData?.items.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.companyName}</TableCell>
                    <TableCell>{app.contactName}</TableCell>
                    <TableCell>{app.phone}</TableCell>
                    <TableCell>{app.email}</TableCell>
                    <TableCell>{app.city ?? "—"}</TableCell>
                    <TableCell>{app.transportType ?? "—"}</TableCell>
                    <TableCell>{app.vehicleCount ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={appStatusVariant[app.status] ?? "outline"}>{app.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReviewTarget(app)}
                      >
                        Examiner
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Review Modal */}
      <Sheet open={!!reviewTarget} onOpenChange={(o) => !o && setReviewTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Examiner la candidature</SheetTitle>
            <SheetDescription>
              <p className="mt-2 font-medium">{reviewTarget?.companyName}</p>
              <p className="text-sm text-muted-foreground">{reviewTarget?.email}</p>
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Décision</Label>
              <div className="flex gap-2">
                <Button
                  variant={reviewStatus === "approved" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReviewStatus("approved")}
                >
                  <CheckCircleIcon className="size-4 mr-1" /> Approuver
                </Button>
                <Button
                  variant={reviewStatus === "rejected" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setReviewStatus("rejected")}
                >
                  <XCircleIcon className="size-4 mr-1" /> Rejeter
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message (optionnel)</Label>
              <textarea
                id="message"
                className="w-full min-h-24 rounded-xl border border-input bg-input/30 px-3 py-2 text-sm"
                placeholder="Message pour le candidat..."
                value={reviewMessage}
                onChange={(e) => setReviewMessage(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>Annuler</Button>
            <Button
              variant={reviewStatus === "approved" ? "default" : "destructive"}
              onClick={() =>
                reviewTarget &&
                reviewMutation.mutate({
                  id: reviewTarget.id,
                  data: { status: reviewStatus, message: reviewMessage || undefined },
                })
              }
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? "Enregistrement..." : "Confirmer"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
