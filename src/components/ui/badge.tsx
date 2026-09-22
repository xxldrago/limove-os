import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "cn"

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link"
  | "success"
  | "danger"
  | "neutral"

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: "badge-success",
  success: "badge-success",
  secondary: "badge-neutral",
  neutral: "badge-neutral",
  outline: "badge-neutral",
  ghost: "badge-neutral",
  link: "badge-neutral",
  destructive: "badge-danger",
  danger: "badge-danger",
}

const badgeVariants = (opts?: { variant?: BadgeVariant | null }) =>
  VARIANT_CLASS[(opts?.variant ?? "default") as BadgeVariant] ?? "badge-success"

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & { variant?: BadgeVariant | null }) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn("badge", badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
