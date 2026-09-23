import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 23.09.2026 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** 23.09.2026 14:35 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} ${hh}:${mi}`;
}

/** $15,000,000 */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-$" : "$";
  return `${sign}${Math.abs(value).toLocaleString("en-US")}`;
}

export function formatSignedMoney(value: number): string {
  const sign = value < 0 ? "-" : "+";
  return `${sign}$${Math.abs(value).toLocaleString("en-US")}`;
}

/** User ID #124 */
export function formatUserId(id: number): string {
  return `#${id}`;
}

/**
 * `plural(n, one, many)` — английское согласование (1 term / 2 terms).
 * `plural(n, one, many, few)` — русское согласование (1 срок / 2 срока / 5 сроков).
 */
export function plural(n: number, one: string, many: string, few?: string): string {
  if (few !== undefined) {
    const m10 = n % 10;
    const m100 = n % 100;
    const word =
      m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
    return `${n} ${word}`;
  }
  return `${n} ${n === 1 ? one : many}`;
}
