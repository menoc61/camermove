"use client"

import * as React from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onDrag" | "onDragEnd" | "onDragStart" | "onAnimationStart" | "onAnimationEnd">

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const [focused, setFocused] = React.useState(false)

    return (
      <motion.input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-input bg-surface-2 px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          className
        )}
        ref={ref}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
        animate={focused ? { boxShadow: "0 0 0 3px rgba(14,159,143,0.15)" } : { boxShadow: "0 0 0 0px rgba(14,159,143,0)" }}
        transition={{ duration: 0.2 }}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
