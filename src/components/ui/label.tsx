"use client"

import * as React from "react"
import { cn } from "cn"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("label", className)} {...props} />
}

export { Label }
