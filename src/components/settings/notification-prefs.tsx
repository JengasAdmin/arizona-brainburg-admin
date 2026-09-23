"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SkeletonRows } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/** Human labels for the keys of DEFAULT_USER_PREFERENCES (fallback: humanized key). */
const PREFERENCE_LABELS: Record<string, string> = {
  notify_leader_events: "Leader events",
  notify_disciplinary: "Disciplinary actions",
  notify_points: "Leadership points",
  notify_roles: "Role changes",
  notify_budget: "Budget changes",
  notify_system: "System notifications",
  digest_unread_badge: "Unread badge counter",
};

function labelFor(key: string): string {
  return PREFERENCE_LABELS[key] ?? key.replace(/^notify_/, "").replace(/_/g, " ");
}

/** Small accessible switch (no new ui primitives added). */
function Toggle({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-1 focus:ring-neutral-600",
        checked ? "border-transparent bg-white" : "border-line2 bg-raised",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all",
          checked ? "left-[18px] bg-black" : "left-0.5 bg-neutral-500",
        )}
      />
    </button>
  );
}

/**
 * Own notification preferences — GET /api/me/preferences (defaults merged in),
 * toggles persist via PATCH /api/me/preferences with { preferences: { key: value } }.
 */
export function NotificationPrefs() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Record<string, unknown> | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await api<{ preferences: Record<string, unknown> }>("/api/me/preferences");
        if (alive) setPrefs(res.preferences);
      } catch (err) {
        if (alive) {
          toast({
            title: "Could not load preferences.",
            description: errorMessage(err),
            variant: "error",
          });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [toast]);

  const toggle = async (key: string, value: boolean) => {
    setPendingKey(key);
    try {
      const res = await api<{ preferences: Record<string, unknown> }>("/api/me/preferences", {
        method: "PATCH",
        body: { preferences: { [key]: value } },
      });
      setPrefs(res.preferences);
    } catch (err) {
      toast({
        title: "Could not save the preference.",
        description: errorMessage(err),
        variant: "error",
      });
      // Re-sync with the server state on failure.
      try {
        const fresh = await api<{ preferences: Record<string, unknown> }>("/api/me/preferences");
        setPrefs(fresh.preferences);
      } catch {
        // Keep the optimistic value — the next toggle will retry.
      }
    } finally {
      setPendingKey(null);
    }
  };

  const entries = prefs ? Object.entries(prefs) : [];

  return (
    <Card>
      <CardHeader
        title="Notification preferences"
        description="Choose which events should raise a notification for your account."
      />
      <CardBody padded={false}>
        {!prefs ? (
          <SkeletonRows rows={5} cols={2} />
        ) : entries.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-neutral-500">No preferences available.</p>
        ) : (
          <div className="divide-y divide-line">
            {entries.map(([key, value]) => {
              const label = labelFor(key);
              if (typeof value === "boolean") {
                return (
                  <div key={key} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[13px] capitalize text-neutral-200">{label}</div>
                      <div className="font-mono text-[11px] text-neutral-600">{key}</div>
                    </div>
                    <Toggle
                      checked={value}
                      label={label}
                      disabled={pendingKey !== null}
                      onToggle={() => void toggle(key, !value)}
                    />
                  </div>
                );
              }
              return (
                <div key={key} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-[13px] capitalize text-neutral-200">{label}</div>
                    <div className="font-mono text-[11px] text-neutral-600">{key}</div>
                  </div>
                  <span className="text-[13px] text-neutral-400">{String(value)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
