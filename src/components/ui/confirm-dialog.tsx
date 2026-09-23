"use client";

import { Dialog, type ConfirmRequest } from "./dialog";
import { Button } from "./button";

/**
 * Confirmation dialog for critical actions (dismiss leader, block user, …).
 * The action itself is still verified server-side — this is UX, not security.
 */
export function ConfirmDialog({
  open,
  request,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  request: ConfirmRequest | null;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!request) return null;
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={request.title}
      description={request.description}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {request.cancelLabel ?? "Отмена"}
          </Button>
          <Button
            variant={request.danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {request.confirmLabel ?? "Подтвердить"}
          </Button>
        </>
      }
    >
      {request.fields?.length ? (
        <dl className="space-y-2">
          {request.fields.map((field) => (
            <div
              key={field.label}
              className="flex items-start justify-between gap-4 rounded-md border border-line bg-panel px-3 py-2"
            >
              <dt className="text-xs text-neutral-500">{field.label}</dt>
              <dd className="text-right text-[13px] text-neutral-200">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Dialog>
  );
}
