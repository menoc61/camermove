"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@camermove/frontend"
import { getAdminStats } from "@/lib/api/admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { UsersIcon, TruckIcon, MapPinIcon, TicketIcon, WalletIcon, CalendarIcon, CheckCircleIcon, ClockIcon, XCircleIcon, BanknoteIcon, TrendingUpIcon } from "lucide-react"

const fmtXaf = (amount: number) =>
  (amount / 100).toLocaleString("fr-FR", { style: "currency", currency: "XAF", maximumFractionDigits: 0 })

const fmtNum = (n: number) => n.toLocaleString("fr-FR")

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  color?: string
}

function StatCard({ label, value, icon, color = "text-primary" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-full p-2.5 bg-muted ${color}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function StatSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminDashboard() {
  const token = useAuthStore((s) => s.accessToken)

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getAdminStats(token!),
    enabled: !!token,
  })

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Erreur de chargement des statistiques.
      </p>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="Utilisateurs total"
          value={fmtNum(data.totalUsers)}
          icon={<UsersIcon className="size-5" />}
          color="text-blue-600"
        />
        <StatCard
          label="Nouveaux aujourd'hui"
          value={fmtNum(data.newUsersToday)}
          icon={<TrendingUpIcon className="size-5" />}
          color="text-green-600"
        />
        <StatCard
          label="Transporteurs"
          value={fmtNum(data.totalTransporters)}
          icon={<TruckIcon className="size-5" />}
          color="text-orange-600"
        />
        <StatCard
          label="Approuvés"
          value={fmtNum(data.approvedTransporters)}
          icon={<CheckCircleIcon className="size-5" />}
          color="text-emerald-600"
        />
        <StatCard
          label="Candidatures en attente"
          value={fmtNum(data.pendingApplications)}
          icon={<ClockIcon className="size-5" />}
          color="text-amber-600"
        />
        <StatCard
          label="Trajets total"
          value={fmtNum(data.totalTrips)}
          icon={<MapPinIcon className="size-5" />}
          color="text-purple-600"
        />
        <StatCard
          label="Trajets actifs"
          value={fmtNum(data.activeTrips)}
          icon={<CalendarIcon className="size-5" />}
          color="text-teal-600"
        />
        <StatCard
          label="Réservations total"
          value={fmtNum(data.totalBookings)}
          icon={<TicketIcon className="size-5" />}
          color="text-indigo-600"
        />
        <StatCard
          label="Réservations aujourd'hui"
          value={fmtNum(data.todayBookings)}
          icon={<TicketIcon className="size-5" />}
          color="text-cyan-600"
        />
        <StatCard
          label="Confirmées aujourd'hui"
          value={fmtNum(data.confirmedToday)}
          icon={<CheckCircleIcon className="size-5" />}
          color="text-green-600"
        />
        <StatCard
          label="Paiements en attente"
          value={fmtNum(data.pendingPayments)}
          icon={<ClockIcon className="size-5" />}
          color="text-yellow-600"
        />
        <StatCard
          label="Revenus totaux"
          value={fmtXaf(data.totalRevenue)}
          icon={<WalletIcon className="size-5" />}
          color="text-emerald-600"
        />
        <StatCard
          label="Commissions totales"
          value={fmtXaf(data.totalCommissions)}
          icon={<BanknoteIcon className="size-5" />}
          color="text-rose-600"
        />
      </div>
    </div>
  )
}
