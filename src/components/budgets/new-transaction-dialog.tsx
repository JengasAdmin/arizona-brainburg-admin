"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { formatMoney } from "@/lib/utils";
import { Plus } from "lucide-react";

interface Form {
  type: string;
  amount: string;
  reason: string;
}

const EMPTY: Form = { type: "deposit", amount: "", reason: "" };

/**
 * Creates a ledger entry via POST /api/budgets/:factionId/transactions
 * (budgetTransactionSchema: type deposit|withdrawal, integer amount > 0, reason 3–500).
 * `balance` is only used for a client-side heads-up — the server enforces sufficiency.
 */
export function NewTransactionDialog({ factionId, balance }: { factionId: number; balance: number }) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [pending, setPending] = useState(false);

  const amount = Number(form.amount);
  const insufficient =
    form.type === "withdrawal" && Number.isFinite(amount) && amount > 0 && amount > balance;

  function validate(value: Form): boolean {
    const next: Partial<Record<keyof Form, string>> = {};
    if (value.type !== "deposit" && value.type !== "withdrawal") {
      next.type = "Choose deposit or withdrawal.";
    }
    const parsed = Number(value.amount);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      next.amount = "Amount must be a whole number greater than zero.";
    } else if (parsed > 1_000_000_000) {
      next.amount = "Amount is too large.";
    }
    const reason = value.reason.trim();
    if (reason.length < 3 || reason.length > 500) {
      next.reason = "Reason must be 3–500 characters.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate(form)) return;
    setPending(true);
    try {
      await api(`/api/budgets/${factionId}/transactions`, {
        method: "POST",
        body: {
          type: form.type,
          amount: Number(form.amount),
          reason: form.reason.trim(),
        },
      });
      toast({
        title: form.type === "deposit" ? "Deposit recorded" : "Withdrawal recorded",
        description: `${formatMoney(Number(form.amount))} — ${form.reason.trim()}`,
        variant: "success",
      });
      setOpen(false);
      setForm(EMPTY);
      setErrors({});
      router.refresh();
    } catch (err) {
      // e.g. INSUFFICIENT_BALANCE — show the exact server message.
      toast({ title: "Transaction rejected", description: errorMessage(err), variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> New transaction
      </Button>

      <Dialog
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title="New transaction"
        description={`Current balance ${formatMoney(balance)} — entries are immutable.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" loading={pending} onClick={submit}>
              Submit transaction
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Type" htmlFor="tx-type" error={errors.type ?? null}>
            <Select
              id="tx-type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="deposit">Deposit (income)</option>
              <option value="withdrawal">Withdrawal (expense)</option>
            </Select>
          </Field>
          <Field label="Amount" htmlFor="tx-amount" error={errors.amount ?? null} hint="whole number, $">
            <Input
              id="tx-amount"
              type="number"
              min={1}
              step={1}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="15000"
            />
          </Field>
          {insufficient ? (
            <p className="rounded-md border border-[#3d3316] bg-[#211c0d] px-3 py-2 text-[11px] text-warn">
              Heads-up: {formatMoney(amount)} exceeds the current balance of{" "}
              {formatMoney(balance)}. The server will reject the withdrawal unless negative
              budgets are allowed.
            </p>
          ) : null}
          <Field label="Reason" htmlFor="tx-reason" error={errors.reason ?? null}>
            <Textarea
              id="tx-reason"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              maxLength={500}
              placeholder="Quarterly equipment budget for patrol units"
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
