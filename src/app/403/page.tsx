import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-line2 bg-raised">
          <ShieldAlert className="h-5 w-5 text-neutral-400" />
        </div>
        <h1 className="text-lg font-semibold text-white">403 — Доступ запрещён</h1>
        <p className="mt-2 text-[13px] text-neutral-500">
          У вас нет прав для выполнения этого действия. Свяжитесь с администратором, если
          считаете, что это ошибка.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-9 items-center rounded-md border border-line2 bg-raised px-4 text-[13px] text-white transition-colors hover:bg-[#262626]"
        >
          Назад к обзору
        </Link>
      </div>
    </main>
  );
}
