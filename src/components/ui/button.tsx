import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 font-medium select-none transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-fg",
        ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-fg",
        outline:
          "border border-line bg-transparent text-fg hover:bg-surface-2",
        danger: "border border-line text-danger hover:bg-surface-2",
        tool: "border border-line bg-surface text-muted hover:text-fg hover:bg-surface-2 data-[on=true]:bg-accent data-[on=true]:text-accent-fg data-[on=true]:border-accent",
      },
      size: {
        sm: "h-7 px-2 text-xs rounded-sm",
        md: "h-9 px-3 text-sm rounded-md",
        icon: "size-9 rounded-md",
        iconSm: "size-7 rounded-sm",
        dock: "size-11 rounded-md",
      },
    },
    defaultVariants: { variant: "outline", size: "sm" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { active?: boolean };

export function Button({
  className,
  variant,
  size,
  active,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      data-on={active ? "true" : undefined}
      {...props}
    />
  );
}
