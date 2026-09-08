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
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = id ? `${id}-listbox` : undefined

  const close = useCallback(() => {
    setOpen(false)
    setActiveIndex(-1)
  }, [])

  const doFetch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setPlaces([])
      close()
      return
    }
    setLoading(true)
    try {
      const data = await fetchPlaces(q)
      setPlaces(data)
      setOpen(data.length > 0)
      setActiveIndex(-1)
    } catch {
      setPlaces([])
    } finally {
      setLoading(false)
    }
  }, [close])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doFetch(val), 300)
  }

  function selectPlace(place: Place) {
    onChange(place.displayName)
    close()
    setPlaces([])
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      close()
      return
    }
    if (!open || places.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % places.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? places.length - 1 : i - 1))
    } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < places.length) {
      e.preventDefault()
      selectPlace(places[activeIndex]!)
    } else if (e.key === "Tab") {
      close()
    }
  }

  const activeId =
    activeIndex >= 0 && activeIndex < places.length
      ? `${listboxId ?? "city-listbox"}-option-${activeIndex}`
      : undefined

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
        aria-activedescendant={activeId}
        aria-busy={loading}
        className={cn("w-full", className)}
        autoComplete="off"
      />
      {(open || loading) && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel ?? "Villes"}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-popover p-1 text-sm shadow-lg"
        >
          {loading && places.length === 0 && (
            <li className="cursor-default rounded-lg px-3 py-2 text-muted-foreground" aria-disabled="true">
              Chargement…
            </li>
          )}
          {places.map((place, i) => (
            <li
              key={place.osmId}
              id={`${listboxId ?? "city-listbox"}-option-${i}`}
              role="option"
              aria-selected={place.displayName === value}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-2 hover:bg-accent hover:text-accent-foreground",
                i === activeIndex && "bg-accent text-accent-foreground"
              )}
              onMouseDown={() => selectPlace(place)}
              onMouseEnter={() => setActiveIndex(i)}
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
