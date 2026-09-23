"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Award, Eye, MoreHorizontal, ShieldAlert, UserX } from "lucide-react";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { DismissDialog } from "./dismiss-dialog";
import { PointsDialog } from "./points-dialog";
import { DisciplinaryDialog } from "./disciplinary-dialog";

export interface RowActionTerm {
  id: number;
  userId: number;
  displayName: string;
  positionTitle: string;
  status: string;
}

type DialogKind = "dismiss" | "points" | "disciplinary";

/**
 * Per-row action menu wiring the three leadership dialogs.
 * The booleans are UI gating only — every endpoint re-checks permissions.
 */
export function RowActions({
  term,
  canDismiss,
  canPoints,
  canDisciplinary,
  historyHref,
}: {
  term: RowActionTerm;
  canDismiss: boolean;
  canPoints: boolean;
  canDisciplinary: boolean;
  historyHref?: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind | null>(null);

  const isActive = term.status === "active";
  const showDismiss = canDismiss && isActive;

  if (!showDismiss && !canPoints && !canDisciplinary && !historyHref) return null;

  return (
    <>
      <Dropdown
        trigger={
          <button
            type="button"
            aria-label={`Actions for ${term.displayName}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-neutral-400 transition-colors hover:bg-raised hover:text-white"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        }
      >
        {(close) => (
          <>
            {showDismiss ? (
              <DropdownItem
                danger
                onClick={() => {
                  close();
                  setDialog("dismiss");
                }}
              >
                <UserX className="h-3.5 w-3.5" /> Dismiss
              </DropdownItem>
            ) : null}
            {canPoints ? (
              <DropdownItem
                onClick={() => {
                  close();
                  setDialog("points");
                }}
              >
                <Award className="h-3.5 w-3.5" /> Add points
              </DropdownItem>
            ) : null}
            {canDisciplinary ? (
              <DropdownItem
                onClick={() => {
                  close();
                  setDialog("disciplinary");
                }}
              >
                <ShieldAlert className="h-3.5 w-3.5" /> Issue warning / reprimand
              </DropdownItem>
            ) : null}
            {historyHref ? (
              <DropdownItem
                onClick={() => {
                  close();
                  router.push(historyHref);
                }}
              >
                <Eye className="h-3.5 w-3.5" /> View history
              </DropdownItem>
            ) : null}
          </>
        )}
      </Dropdown>

      <DismissDialog open={dialog === "dismiss"} onClose={() => setDialog(null)} term={term} />
      <PointsDialog open={dialog === "points"} onClose={() => setDialog(null)} term={term} />
      <DisciplinaryDialog
        open={dialog === "disciplinary"}
        onClose={() => setDialog(null)}
        term={term}
      />
    </>
  );
}
