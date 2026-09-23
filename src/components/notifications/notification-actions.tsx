"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";

/**
 * "Mark all read" — POST /api/notifications marks every own notification read.
 * Renders nothing while there is nothing unread.
 */
export function NotificationActions({ unread }: { unread: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  if (unread <= 0) return null;

  const markAll = async () => {
    setPending(true);
    try {
      await api("/api/notifications", { method: "POST" });
      toast({ title: "Все уведомления отмечены как прочитанные.", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Не удалось отметить уведомления как прочитанные.",
        description: errorMessage(err),
        variant: "error",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Button size="sm" variant="outline" loading={pending} onClick={() => void markAll()}>
      <CheckCheck className="h-3.5 w-3.5" /> Отметить все прочитанными
    </Button>
  );
}

/** Per-row "Mark read" — POST /api/notifications/:id/read */
export function NotificationMarkRead({ id }: { id: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  const markRead = async () => {
    setPending(true);
    try {
      await api(`/api/notifications/${id}/read`, { method: "POST" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Не удалось отметить уведомление как прочитанное.",
        description: errorMessage(err),
        variant: "error",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() => void markRead()}
      aria-label="Отметить как прочитанное"
    >
      <Check className="h-3.5 w-3.5" /> Отметить прочитанным
    </Button>
  );
}
