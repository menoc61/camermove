"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const AgencyMapInner = dynamic(
  () => import("@/components/landing/AgencyMap").then((m) => m.AgencyMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[360px] w-full rounded-xl md:h-[420px]" />,
  }
)

import type { Agency } from "@/lib/api/agencies"

export function AgencyMapDynamic(props: {
  agencies: Array<{ id: string; companyName: string; city: string | null; lat: number | null; lon: number | null; tagline?: string | null; departurePointInfo?: string | null }>
  city?: string
  lat?: number
  lon?: number
}) {
  return <AgencyMapInner {...(props as unknown as { agencies: Agency[]; city?: string; lat?: number; lon?: number })} />
}
