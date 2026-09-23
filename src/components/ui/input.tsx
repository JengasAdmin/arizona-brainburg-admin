"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-md border border-line bg-panel px-3 text-[13px] text-white placeholder:text-neutral-600",
          "transition-colors focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-700",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[80px] w-full rounded-md border border-line bg-panel px-3 py-2 text-[13px] text-white placeholder:text-neutral-600",
        "transition-colors focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-700",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-9 w-full appearance-none rounded-md border border-line bg-panel px-3 text-[13px] text-white",
          "transition-colors focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-700",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

export function Label({
  children,
  htmlFor,
  hint,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-1.5 flex items-baseline justify-between gap-2", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-neutral-400">
        {children}
      </label>
      {hint ? <span className="text-[11px] text-neutral-600">{hint}</span> : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
      {error ? <p className="mt-1 text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
