import { cn } from "@/lib/utils";

type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "solid";

const tones: Record<Tone, string> = {
  neutral: "border-line2 bg-raised text-neutral-300",
  ok: "border-[#1f3d2a] bg-[#0f2118] text-ok",
  warn: "border-[#3d3316] bg-[#211c0d] text-warn",
  danger: "border-[#3d1a1c] bg-[#210f10] text-danger",
  info: "border-[#1a2a3d] bg-[#0f1721] text-info",
  solid: "border-transparent bg-white text-black",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" /> : null}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  active: "ok",
  dismissed: "neutral",
  suspended: "warn",
  blocked: "danger",
  inactive: "neutral",
  player: "neutral",
  verified: "ok",
  unverified: "warn",
  deposit: "ok",
  withdrawal: "danger",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  inactive: "Неактивен",
  suspended: "Приостановлен",
  blocked: "Заблокирован",
  dismissed: "Отстранён",
  pending: "Ожидает",
  player: "Игрок",
  verified: "Подтверждён",
  unverified: "Не подтверждён",
  deposit: "Пополнение",
  withdrawal: "Вывод",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const text = label ?? STATUS_LABELS[status] ?? status;
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} dot>
      {text.charAt(0).toUpperCase() + text.slice(1)}
    </Badge>
  );
}
