"use client"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function EmptyState({ title, cta }: { title: string; cta?: { href: string; label: string } }) {
  return (
    <Card>
      <CardContent className="p-6 text-center">
        <p className="text-sm text-muted-foreground">{title}</p>
        {cta ? (
          <Link href={cta.href} className={cn(buttonVariants(), "mt-4 rounded-full")}>
            {cta.label}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  )
}
