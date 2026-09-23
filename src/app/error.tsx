"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

/** 500 — Internal Server Error. Never shows stack traces to the user. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-line2 bg-raised">
          <AlertTriangle className="h-5 w-5 text-neutral-400" />
        </div>
        <h1 className="text-lg font-semibold text-white">500 — Internal Server Error</h1>
        <p className="mt-2 text-[13px] text-neutral-500">
          Something went wrong on our side. The incident has been logged.
          {error?.digest ? (
            <span className="mt-1 block text-[11px] text-neutral-700">Reference: {error.digest}</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-9 items-center gap-2 rounded-md border border-line2 bg-raised px-4 text-[13px] text-white transition-colors hover:bg-[#262626]"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    </main>
  );
}
