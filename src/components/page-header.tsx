import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">{title}</h1>
        {description ? (
          <p className="mt-1 text-xs text-neutral-500 sm:text-[13px]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="rounded-lg border border-line bg-card p-4 transition-colors hover:border-line2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-600">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-neutral-600">{hint}</div> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
