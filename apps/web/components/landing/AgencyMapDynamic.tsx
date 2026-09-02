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

export function AgencyMapDynamic(props: { agencies: Agency[]; city?: string; lat?: number; lon?: number }) {
  return <AgencyMapInner {...props} />
}
