import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cn } from "cn"

type Variant =
  | "default"
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link"
type Size = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-xs" | "icon-lg"

const VARIANT_CLASS: Record<Variant, string> = {
  default: "btn-primary",
  primary: "btn-primary",
  secondary: "btn-secondary",
  outline: "btn-secondary",
  ghost: "btn-ghost",
  destructive: "btn-danger",
  link: "btn-ghost",
}

const SIZE_CLASS: Record<Size, string> = {
  default: "",
  sm: "btn-sm",
  lg: "btn-lg",
  icon: "btn-icon",
  "icon-sm": "btn-icon btn-sm",
  "icon-xs": "btn-icon btn-sm",
  "icon-lg": "btn-icon",
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & { variant?: Variant; size?: Size }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn("btn", VARIANT_CLASS[variant] ?? "btn-primary", SIZE_CLASS[size] ?? "", className)}
      {...props}
    />
  )
}

export { Button }
