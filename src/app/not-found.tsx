import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-line2 bg-raised">
          <FileQuestion className="h-5 w-5 text-neutral-400" />
        </div>
        <h1 className="text-lg font-semibold text-white">404 — Not Found</h1>
        <p className="mt-2 text-[13px] text-neutral-500">
          The page you are looking for does not exist or was removed.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-9 items-center rounded-md border border-line2 bg-raised px-4 text-[13px] text-white transition-colors hover:bg-[#262626]"
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}
