import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-1 text-neutral-700">{icon}</div> : null}
      <p className="text-sm font-medium text-neutral-300">{title}</p>
      {description ? (
        <p className="max-w-md text-xs text-neutral-600">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
}

export function SkeletonRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: cols }).map((__, colIndex) => (
            <div
              key={colIndex}
              className="skeleton h-4 flex-1"
              style={{ opacity: 1 - rowIndex * 0.12 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-10", className)}>
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-700 border-t-neutral-300" />
    </div>
  );
}
