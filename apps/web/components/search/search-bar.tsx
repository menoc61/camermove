"use client"
import { useRouter } from "next/navigation"
import { useSearchStore, t } from "@camermove/frontend"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button, buttonVariants } from "@/components/ui/button"
import { Search, ArrowRight, Calendar, Users } from "lucide-react"
import { cn } from "@/lib/utils"

export function SearchBar() {
  const router = useRouter()
  const { origin, destination, date, pax, setSearch } = useSearchStore()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams({ origin, destination, date, pax: String(pax) })
    router.push(`/results?${params.toString()}`)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Route fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel className="sr-only">{t("search.origin")}</FieldLabel>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              className="pl-9"
              placeholder={t("search.origin")}
              value={origin}
              onChange={(e) => setSearch({ origin: e.target.value })}
              required
            />
          </div>
        </Field>

        <Field>
          <FieldLabel className="sr-only">{t("search.destination")}</FieldLabel>
          <div className="relative">
            <ArrowRight className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              className="pl-9"
              placeholder={t("search.destination")}
              value={destination}
              onChange={(e) => setSearch({ destination: e.target.value })}
              required
            />
          </div>
        </Field>
      </div>

      {/* Date + passengers */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel className="sr-only">Date</FieldLabel>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              type="date"
              className="pl-9"
              value={date}
              onChange={(e) => setSearch({ date: e.target.value })}
              required
            />
          </div>
        </Field>

        <Field>
          <FieldLabel className="sr-only">Passagers</FieldLabel>
          <div className="relative">
            <Users className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Select
              value={String(pax)}
              onValueChange={(v) => setSearch({ pax: Number(v) })}
            >
              <SelectTrigger className="pl-9">
                <SelectValue placeholder="Passagers" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} {n === 1 ? "passager" : "passagers"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Field>

        <Button
          type="submit"
          size="lg"
          className="col-span-2 sm:col-span-1 w-full"
        >
          <Search className="size-4" />
          Rechercher
        </Button>
      </div>
    </form>
  )
}
