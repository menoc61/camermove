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
  html: `
    <div class="marker-icon" style="
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: marker-bounce .4s cubic-bezier(.34,1.56,.64,1) both;
    ">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="14" r="13" fill="#0e9f8f" stroke="white" stroke-width="2"/>
        <circle cx="14" cy="14" r="5" fill="white"/>
      </svg>
    </div>
    <style>
      @keyframes marker-bounce {
        0% { transform: scale(0); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
    </style>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
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
    <div className="relative h-[360px] w-full rounded-2xl overflow-hidden shadow-lg md:h-[420px]">
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
                <div className="rounded-xl shadow-lg p-4 min-w-[180px] text-sm">
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

      {/* Floating legend card */}
      <div className="absolute top-3 right-3 z-[1000] rounded-xl bg-white/90 shadow-lg backdrop-blur-sm px-4 py-2 flex items-center gap-2 text-sm font-medium">
        <svg width="16" height="16" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="14" cy="14" r="13" fill="#0e9f8f" stroke="white" stroke-width="2"/>
          <circle cx="14" cy="14" r="5" fill="white"/>
        </svg>
        <span>{agencies.length} agence{agencies.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  )
}

export function AgencyMap(props: AgencyMapProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <Skeleton className="h-[360px] w-full rounded-2xl md:h-[420px]" />
  }

  return <AgencyMapInner {...props} />
}
