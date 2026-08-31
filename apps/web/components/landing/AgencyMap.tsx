"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import type { Agency } from "@/lib/api/agencies"

const DEFAULT_CENTER: [number, number] = [3.848, 11.498] // Yaoundé

const markerIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:12px;height:12px;background:#0e9f8f;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 12)
  }, [map, center])
  return null
}

interface AgencyMapProps {
  city?: string
  lat?: number
  lon?: number
  agencies: Agency[]
}

export function AgencyMapInner({ city, lat, lon, agencies }: AgencyMapProps) {
  const center: [number, number] =
    lat != null && lon != null ? [lat, lon] : DEFAULT_CENTER

  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-xl border md:h-[420px]">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        className="h-full w-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater center={center} />
        {agencies.map((a) =>
          a.lat != null && a.lon != null ? (
            <Marker key={a.id} position={[a.lat, a.lon]} icon={markerIcon}>
              <Popup>
                <div className="min-w-[180px] text-sm">
                  <p className="font-semibold">{a.companyName}</p>
                  {a.departurePointInfo && (
                    <p className="text-muted-foreground">{a.departurePointInfo}</p>
                  )}
                  {a.city && <p className="text-muted-foreground">{a.city}</p>}
                  <Link
                    href={`/results?origin=${encodeURIComponent(city ?? "")}&destination=&pax=1`}
                    className="mt-1 inline-block font-medium text-primary hover:underline"
                  >
                    Voir les départs →
                  </Link>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>
    </div>
  )
}

export function AgencyMap(props: AgencyMapProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <Skeleton className="h-[360px] w-full rounded-xl md:h-[420px]" />
  }

  return <AgencyMapInner {...props} />
}
