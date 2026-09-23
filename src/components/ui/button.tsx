"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-white text-black hover:bg-neutral-200 disabled:hover:bg-white border border-transparent",
  secondary:
    "bg-raised text-neutral-200 border border-line hover:bg-[#262626] hover:text-white disabled:hover:bg-raised",
  outline:
    "bg-transparent text-neutral-200 border border-line2 hover:border-neutral-500 hover:text-white",
  ghost: "bg-transparent text-neutral-300 hover:bg-raised hover:text-white border border-transparent",
  danger: "bg-[#2a1113] text-red-300 border border-[#4a1e22] hover:bg-[#3a171a] hover:text-red-200",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-[13px] gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  icon: "h-8 w-8 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-md font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
});
