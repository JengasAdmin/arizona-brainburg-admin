"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ConfirmRequest } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";

/** Revokes a single assigned role (DELETE /api/users/:id/roles/:roleKey). */
export function RoleRowActions({
  userId,
  roleKey,
  roleTitle,
}: {
  userId: number;
  roleKey: string;
  roleTitle: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [loading, setLoading] = useState(false);

  const revoke = async () => {
    setLoading(true);
    try {
      await api(`/api/users/${userId}/roles/${encodeURIComponent(roleKey)}`, { method: "DELETE" });
      toast({
        title: "Роль отозвана",
        description: `«${roleTitle}» удалена у пользователя #${userId}.`,
        variant: "success",
      });
      setRequest(null);
      router.refresh();
    } catch (err) {
      toast({ title: "Не удалось отозвать роль", description: errorMessage(err), variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          setRequest({
            title: "Отзыв роли",
            description: `Удалить «${roleTitle}» с этого аккаунта?`,
            confirmLabel: "Отозвать",
            danger: true,
          })
        }
      >
        Отозвать
      </Button>
      <ConfirmDialog
        open={request !== null}
        request={request}
        loading={loading}
        onConfirm={revoke}
        onCancel={() => setRequest(null)}
      />
    </>
  );
}
