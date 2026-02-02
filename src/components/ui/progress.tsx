"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-white/10 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 transition-all duration-500 ease-out rounded-full"
        style={{
          transform: `translateX(-${100 - (value || 0)}%)`,
          background: 'linear-gradient(90deg, #0066CC 0%, #0099FF 100%)',
          boxShadow: '0 0 10px rgba(0, 102, 204, 0.5)',
        }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
