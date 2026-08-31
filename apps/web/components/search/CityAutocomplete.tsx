"use client"

import { useState, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { fetchPlaces, type Place } from "@/lib/api/places"

interface CityAutocompleteProps {
  value: string
  onChange: (city: string) => void
  placeholder?: string
  className?: string
  id?: string
  "aria-label"?: string
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder = "Ville",
  className,
  id,
  "aria-label": ariaLabel,
}: CityAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [places, setPlaces] = useState<Place[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = id ? `${id}-listbox` : undefined

  const doFetch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setPlaces([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchPlaces(q)
      setPlaces(data)
      setOpen(data.length > 0)
    } catch {
      setPlaces([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doFetch(val), 300)
  }

  function selectPlace(place: Place) {
    onChange(place.displayName)
    setOpen(false)
    setPlaces([])
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => places.length > 0 && setOpen(true)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        className={cn("w-full", className)}
        autoComplete="off"
      />
      {open && places.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel ?? "Villes"}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-popover p-1 text-sm shadow-lg"
        >
          {places.map((place) => (
            <li
              key={place.osmId}
              role="option"
              aria-selected={place.displayName === value}
              className="cursor-pointer rounded-lg px-3 py-2 hover:bg-accent hover:text-accent-foreground"
              onMouseDown={() => selectPlace(place)}
            >
              <span className="font-medium">{place.displayName}</span>
              {place.city && place.city !== place.displayName && (
                <span className="ml-1 text-muted-foreground">· {place.city}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
