import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\s_]/gu, "")
    .split(/[\s_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  src,
  name,
  size = 32,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const fallback = initials(name) || "?";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-md border border-line bg-raised text-[11px] font-semibold text-neutral-400",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        fallback
      )}
    </span>
  );
}
