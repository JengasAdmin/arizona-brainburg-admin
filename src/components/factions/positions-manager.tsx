"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Layers, Pencil, Plus } from "lucide-react";

/** Serializable position row as returned by getFactionDetail. */
export interface FactionPositionView {
  id: number;
  key: string;
  title: string;
  kind: string;
  sortOrder: number;
  maxActiveTerms: number;
  status: string;
  description: string | null;
  activeTerms: number;
}

interface AddForm {
  key: string;
  title: string;
  kind: string;
  maxActiveTerms: string;
  sortOrder: string;
  description: string;
}

const EMPTY_ADD: AddForm = {
  key: "",
  title: "",
  kind: "leader",
  maxActiveTerms: "1",
  sortOrder: "0",
  description: "",
};

const KIND_OPTIONS = [
  { value: "leader", label: "Leader" },
  { value: "deputy", label: "Deputy" },
];

export function PositionsManager({
  factionId,
  positions,
  canManage,
}: {
  factionId: number;
  positions: FactionPositionView[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD);
  const [addErrors, setAddErrors] = useState<Partial<Record<keyof AddForm, string>>>({});

  const [editing, setEditing] = useState<FactionPositionView | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    kind: "leader",
    maxActiveTerms: "1",
    sortOrder: "0",
    status: "active",
    description: "",
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const [pending, setPending] = useState(false);

  function validateAdd(form: AddForm): boolean {
    const errors: Partial<Record<keyof AddForm, string>> = {};
    if (!/^[a-z0-9_]{2,60}$/.test(form.key.trim())) {
      errors.key = "Key must be 2–60 lowercase letters, digits or underscores.";
    }
    const title = form.title.trim();
    if (title.length < 2 || title.length > 80) errors.title = "Title must be 2–80 characters.";
    const max = Number(form.maxActiveTerms);
    if (!Number.isInteger(max) || max < 1 || max > 10) {
      errors.maxActiveTerms = "Must be a whole number between 1 and 10.";
    }
    const order = Number(form.sortOrder);
    if (!Number.isInteger(order) || order < 0) errors.sortOrder = "Must be a whole number ≥ 0.";
    if (form.description.trim().length > 300) {
      errors.description = "Description must be at most 300 characters.";
    }
    setAddErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submitAdd() {
    if (!validateAdd(addForm)) return;
    setPending(true);
    try {
      await api(`/api/factions/${factionId}/positions`, {
        method: "POST",
        body: {
          key: addForm.key.trim(),
          title: addForm.title.trim(),
          kind: addForm.kind,
          maxActiveTerms: Number(addForm.maxActiveTerms),
          sortOrder: Number(addForm.sortOrder),
          description: addForm.description.trim() ? addForm.description.trim() : null,
        },
      });
      toast({ title: "Position added", description: addForm.title.trim(), variant: "success" });
      setAddOpen(false);
      setAddForm(EMPTY_ADD);
      setAddErrors({});
      router.refresh();
    } catch (err) {
      toast({ title: "Could not add position", description: errorMessage(err), variant: "error" });
    } finally {
      setPending(false);
    }
  }

  function openEdit(position: FactionPositionView) {
    setEditing(position);
    setEditForm({
      title: position.title,
      kind: position.kind,
      maxActiveTerms: String(position.maxActiveTerms),
      sortOrder: String(position.sortOrder),
      status: position.status,
      description: position.description ?? "",
    });
    setEditErrors({});
  }

  function validateEdit(form: typeof editForm): boolean {
    const errors: Record<string, string> = {};
    const title = form.title.trim();
    if (title.length < 2 || title.length > 80) errors.title = "Title must be 2–80 characters.";
    const max = Number(form.maxActiveTerms);
    if (!Number.isInteger(max) || max < 1 || max > 10) {
      errors.maxActiveTerms = "Must be a whole number between 1 and 10.";
    }
    const order = Number(form.sortOrder);
    if (!Number.isInteger(order) || order < 0) errors.sortOrder = "Must be a whole number ≥ 0.";
    if (form.description.trim().length > 300) {
      errors.description = "Description must be at most 300 characters.";
    }
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submitEdit() {
    if (!editing || !validateEdit(editForm)) return;
    setPending(true);
    try {
      await api(`/api/factions/positions/${editing.id}`, {
        method: "PATCH",
        body: {
          title: editForm.title.trim(),
          kind: editForm.kind,
          maxActiveTerms: Number(editForm.maxActiveTerms),
          sortOrder: Number(editForm.sortOrder),
          status: editForm.status,
          description: editForm.description.trim() ? editForm.description.trim() : null,
        },
      });
      toast({ title: "Position updated", description: editForm.title.trim(), variant: "success" });
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Could not update position", description: errorMessage(err), variant: "error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Positions"
        description={`${positions.length} named position${positions.length === 1 ? "" : "s"}`}
        actions={
          canManage ? (
            <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add position
            </Button>
          ) : null
        }
      />

      {positions.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-8 w-8" />}
          title="No positions yet"
          description="Add named leader and deputy positions for this faction."
        />
      ) : (
        <Table className="min-w-[640px]">
          <THead>
            <TR>
              <TH>Position</TH>
              <TH>Kind</TH>
              <TH align="right">Order</TH>
              <TH align="right">Active terms</TH>
              <TH>Status</TH>
              {canManage ? <TH align="right">Actions</TH> : null}
            </TR>
          </THead>
          <TBody>
            {positions.map((position) => (
              <TR key={position.id}>
                <TD>
                  <div className="text-neutral-200">{position.title}</div>
                  <div className="text-[11px] text-neutral-600">{position.key}</div>
                </TD>
                <TD>
                  <Badge tone={position.kind === "leader" ? "info" : "neutral"}>{position.kind}</Badge>
                </TD>
                <TD align="right" className="text-neutral-500">
                  {position.sortOrder}
                </TD>
                <TD align="right" className="text-neutral-500">
                  {position.activeTerms} / {position.maxActiveTerms}
                </TD>
                <TD>
                  <StatusBadge status={position.status} />
                </TD>
                {canManage ? (
                  <TD align="right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(position)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </TD>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {/* ------------------------------- Add dialog ------------------------------- */}
      <Dialog
        open={addOpen}
        onClose={() => (pending ? undefined : setAddOpen(false))}
        title="Add position"
        description="Positions are stored as data — renaming them later never rewrites history."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" loading={pending} onClick={submitAdd}>
              Add position
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Key" htmlFor="pos-key" error={addErrors.key ?? null} hint="lowercase_snake">
            <Input
              id="pos-key"
              value={addForm.key}
              onChange={(e) => setAddForm((f) => ({ ...f, key: e.target.value }))}
              placeholder="chief_of_lspd"
            />
          </Field>
          <Field label="Title" htmlFor="pos-title" error={addErrors.title ?? null}>
            <Input
              id="pos-title"
              value={addForm.title}
              onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Chief of Los Santos Police Department"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Kind" htmlFor="pos-kind">
              <Select
                id="pos-kind"
                value={addForm.kind}
                onChange={(e) => setAddForm((f) => ({ ...f, kind: e.target.value }))}
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Max terms" htmlFor="pos-max" error={addErrors.maxActiveTerms ?? null}>
              <Input
                id="pos-max"
                type="number"
                min={1}
                max={10}
                value={addForm.maxActiveTerms}
                onChange={(e) => setAddForm((f) => ({ ...f, maxActiveTerms: e.target.value }))}
              />
            </Field>
            <Field label="Order" htmlFor="pos-order" error={addErrors.sortOrder ?? null}>
              <Input
                id="pos-order"
                type="number"
                min={0}
                value={addForm.sortOrder}
                onChange={(e) => setAddForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Description" htmlFor="pos-desc" error={addErrors.description ?? null} hint="optional">
            <Textarea
              id="pos-desc"
              value={addForm.description}
              onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={300}
            />
          </Field>
        </div>
      </Dialog>

      {/* ------------------------------- Edit dialog ----------------------------- */}
      <Dialog
        open={editing !== null}
        onClose={() => (pending ? undefined : setEditing(null))}
        title="Edit position"
        description={editing ? editing.key : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" loading={pending} onClick={submitEdit}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title" htmlFor="edit-title" error={editErrors.title ?? null}>
            <Input
              id="edit-title"
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Kind" htmlFor="edit-kind">
              <Select
                id="edit-kind"
                value={editForm.kind}
                onChange={(e) => setEditForm((f) => ({ ...f, kind: e.target.value }))}
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Max terms" htmlFor="edit-max" error={editErrors.maxActiveTerms ?? null}>
              <Input
                id="edit-max"
                type="number"
                min={1}
                max={10}
                value={editForm.maxActiveTerms}
                onChange={(e) => setEditForm((f) => ({ ...f, maxActiveTerms: e.target.value }))}
              />
            </Field>
            <Field label="Order" htmlFor="edit-order" error={editErrors.sortOrder ?? null}>
              <Input
                id="edit-order"
                type="number"
                min={0}
                value={editForm.sortOrder}
                onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status" htmlFor="edit-status">
              <Select
                id="edit-status"
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
          </div>
          <Field label="Description" htmlFor="edit-desc" error={editErrors.description ?? null} hint="optional">
            <Textarea
              id="edit-desc"
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={300}
            />
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}
