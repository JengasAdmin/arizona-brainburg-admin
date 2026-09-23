"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

export interface AppointFaction {
  id: number;
  name: string;
}

export interface AppointPosition {
  id: number;
  factionId: number;
  factionName: string;
  title: string;
  /** leader | deputy */
  kind: string;
  /** active | inactive */
  status: string;
}

interface Form {
  userId: string;
  /** Faction filter — the submitted appointment derives its faction from the position. */
  factionId: string;
  positionId: string;
  reason: string;
  startDate: string;
}

type FormError = Partial<Record<"userId" | "positionId" | "reason", string>>;

function localToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function emptyForm(): Form {
  return { userId: "", factionId: "", positionId: "", reason: "", startDate: localToday() };
}

/**
 * Appointment form used by both pages:
 *   mode="leader"  → leader-kind positions (server requires APPOINT_LEADER),
 *   mode="deputy"  → deputy-kind positions (server requires MANAGE_DEPUTIES).
 *
 * POST /api/leaders body: { userId, positionId, appointedAt?, reason } —
 * the faction is derived from the selected position, so there is no
 * factionKey/scope/roleKey field in the API.
 */
export function AppointLeaderDialog({
  mode,
  factions,
  positions,
  label,
}: {
  mode: "leader" | "deputy";
  factions: AppointFaction[];
  positions: AppointPosition[];
  label?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const kind = mode === "leader" ? "leader" : "deputy";
  const triggerLabel = label ?? (mode === "leader" ? "Appoint leader" : "Appoint deputy");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [errors, setErrors] = useState<FormError>({});
  const [pending, setPending] = useState(false);

  const available = positions.filter(
    (position) =>
      position.kind === kind &&
      position.status === "active" &&
      (form.factionId === "" || position.factionId === Number(form.factionId)),
  );

  // The position must be re-picked whenever the faction filter changes.
  useEffect(() => {
    setForm((prev) => (prev.positionId === "" ? prev : { ...prev, positionId: "" }));
    setErrors((prev) => (prev.positionId ? { ...prev, positionId: undefined } : prev));
  }, [form.factionId]);

  function validate(): boolean {
    const next: FormError = {};
    const rawId = form.userId.trim().replace(/^#/, "");
    const userId = Number(rawId);
    if (!/^\d+$/.test(rawId) || !Number.isInteger(userId) || userId <= 0) {
      next.userId = "Enter a valid numeric user ID, e.g. #124.";
    }
    const positionId = Number(form.positionId);
    if (!Number.isInteger(positionId) || positionId <= 0) {
      next.positionId = "Select a position.";
    }
    const reason = form.reason.trim();
    if (reason.length < 3 || reason.length > 500) {
      next.reason = "Reason must be 3–500 characters.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
    setForm(emptyForm());
    setErrors({});
  }

  async function submit() {
    if (!validate()) return;
    setPending(true);
    try {
      const positionId = Number(form.positionId);
      const result = await api<{ termId: number; termNumber: number }>("/api/leaders", {
        method: "POST",
        body: {
          userId: Number(form.userId.trim().replace(/^#/, "")),
          positionId,
          ...(form.startDate ? { appointedAt: form.startDate } : {}),
          reason: form.reason.trim(),
        },
      });
      const position = positions.find((p) => p.id === positionId);
      toast({
        title: mode === "leader" ? "Leader appointed" : "Deputy appointed",
        description: position
          ? `Term #${result.termNumber} — ${position.title} (${position.factionName}).`
          : `Term #${result.termNumber} created.`,
        variant: "success",
      });
      setOpen(false);
      setForm(emptyForm());
      setErrors({});
      router.refresh();
    } catch (err) {
      toast({ title: "Appointment failed", description: errorMessage(err), variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="h-3.5 w-3.5" />
        {triggerLabel}
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        title={triggerLabel}
        description="Appointments always create a new immutable term — history is never overwritten."
        footer={
          <>
            <Button variant="ghost" onClick={handleClose} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void submit()} loading={pending}>
              {triggerLabel}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="User ID" htmlFor="appoint-user-id" error={errors.userId}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-neutral-600">
                #
              </span>
              <Input
                id="appoint-user-id"
                className="pl-7"
                inputMode="numeric"
                autoComplete="off"
                placeholder="124"
                value={form.userId}
                onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
              />
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Faction" htmlFor="appoint-faction" hint="Filter">
              <Select
                id="appoint-faction"
                value={form.factionId}
                onChange={(e) => setForm((prev) => ({ ...prev, factionId: e.target.value }))}
              >
                <option value="">All factions</option>
                {factions.map((faction) => (
                  <option key={faction.id} value={String(faction.id)}>
                    {faction.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Position" htmlFor="appoint-position" error={errors.positionId}>
              <Select
                id="appoint-position"
                value={form.positionId}
                onChange={(e) => setForm((prev) => ({ ...prev, positionId: e.target.value }))}
              >
                <option value="">Select a position…</option>
                {available.map((position) => (
                  <option key={position.id} value={String(position.id)}>
                    {position.title} — {position.factionName}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {available.length === 0 ? (
            <p className="text-[11px] text-neutral-600">
              No active {kind} positions match this faction.
            </p>
          ) : null}

          <Field label="Start date" htmlFor="appoint-start-date" hint="YYYY-MM-DD">
            <Input
              id="appoint-start-date"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </Field>

          <Field
            label="Reason"
            htmlFor="appoint-reason"
            hint="3–500 characters"
            error={errors.reason}
          >
            <Textarea
              id="appoint-reason"
              placeholder="Why is this appointment being made?"
              value={form.reason}
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
