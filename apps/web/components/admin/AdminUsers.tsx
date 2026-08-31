"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { listUsers, updateUser, deleteUser } from "@/lib/api/admin"
import type { UserItem } from "@/lib/api/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { MoreHorizontalIcon, SearchIcon, ChevronLeftIcon, ChevronRightIcon, Trash2Icon, AlertTriangleIcon } from "lucide-react"

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR")
const fmtNum = (n: number) => n.toLocaleString("fr-FR")

const roleVariant: Record<string, "default" | "secondary" | "outline"> = {
  super_admin: "destructive" as any,
  admin: "secondary",
  transporter_staff: "outline",
  traveler: "default",
}

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  inactive: "secondary",
  suspended: "destructive" as any,
}

const ROLES = ["traveler", "transporter_staff", "admin", "super_admin"]
const STATUSES = ["active", "inactive", "suspended"]

function UserRowSkeleton() {
  return (
    <TableRow>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-24" />
        </TableCell>
      ))}
    </TableRow>
  )
}

export function AdminUsers() {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null)
  const limit = 20

  const params: Record<string, string> = {
    page: String(page),
    limit: String(limit),
  }
  if (search) params.q = search
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", params],
    queryFn: () => listUsers(token!, params),
    enabled: !!token,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateUser(token!, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] })
      toast.success("Utilisateur mis à jour")
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(token!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] })
      toast.success("Utilisateur supprimé")
      setDeleteTarget(null)
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  })

  const totalPages = data?.totalPages ?? 1

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par email, nom..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Du</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Au</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="w-36" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Tél.</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Réservations</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <UserRowSkeleton key={i} />)}
            {!isLoading && data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Aucun utilisateur trouvé.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.items.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell>{user.phone ?? "—"}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <span className="cursor-pointer rounded border border-transparent px-1.5 py-0.5 text-xs font-medium hover:bg-muted">
                        <Badge variant={roleVariant[user.role] ?? "outline"}>{user.role}</Badge>
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {ROLES.map((r) => (
                        <DropdownMenuItem key={r} onClick={() => updateMutation.mutate({ id: user.id, data: { role: r } })}>
                          {r}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <span className="cursor-pointer rounded border border-transparent px-1.5 py-0.5 text-xs font-medium hover:bg-muted">
                        <Badge variant={statusVariant[user.status] ?? "outline"}>{user.status}</Badge>
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {STATUSES.map((s) => (
                        <DropdownMenuItem key={s} onClick={() => updateMutation.mutate({ id: user.id, data: { status: s } })}>
                          {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell>{fmtNum(user._count.bookings)}</TableCell>
                <TableCell>{fmtDate(user.createdAt)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(user)}>
                    <Trash2Icon className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data ? `${fmtNum(data.total)} utilisateurs` : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="text-sm">Page {page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Sheet */}
      <Sheet open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Supprimer l'utilisateur</SheetTitle>
            <SheetDescription>
              <div className="flex items-center gap-2 text-destructive mt-2">
                <AlertTriangleIcon className="size-5" />
                <span>Cette action est irréversible.</span>
              </div>
              <p className="mt-2">
                Voulez-vous vraiment supprimer <strong>{deleteTarget?.email}</strong> ?
              </p>
            </SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
