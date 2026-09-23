"use client";

import { useState } from "react";
import { LogOut, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

export interface SecurityProvider {
  provider: string;
  username: string | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 py-2.5 last:border-b-0">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="min-w-0 truncate text-right text-[13px] text-neutral-200">{children}</span>
    </div>
  );
}

/**
 * Session security: sign out (POST /api/auth/logout) and sign out of every
 * device (POST /api/auth/logout-all — confirmed, revokes all sessions).
 */
export function SecurityPanel({
  createdAt,
  lastLoginAt,
  providers,
}: {
  createdAt: string;
  lastLoginAt: string | null;
  providers: SecurityProvider[];
}) {
  const { toast } = useToast();
  const [confirmAll, setConfirmAll] = useState(false);
  const [pendingAll, setPendingAll] = useState(false);
  const [pendingSignOut, setPendingSignOut] = useState(false);

  const signOut = async () => {
    setPendingSignOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch (err) {
      toast({ title: "Sign out failed.", description: errorMessage(err), variant: "error" });
      setPendingSignOut(false);
      return;
    }
    window.location.assign("/");
  };

  const signOutAll = async () => {
    setPendingAll(true);
    try {
      await api("/api/auth/logout-all", { method: "POST" });
    } catch (err) {
      toast({
        title: "Could not sign out of all devices.",
        description: errorMessage(err),
        variant: "error",
      });
      setPendingAll(false);
      setConfirmAll(false);
      return;
    }
    window.location.assign("/");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Session"
          description="Details of your current sign-in session."
        />
        <CardBody>
          <Row label="Account created">{formatDateTime(createdAt)}</Row>
          <Row label="Last sign-in">{formatDateTime(lastLoginAt)}</Row>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Connected sign-in providers"
          description="Read-only view of the OAuth accounts linked to your profile."
        />
        <CardBody>
          {providers.length === 0 ? (
            <p className="text-[13px] text-neutral-500">No external accounts connected.</p>
          ) : (
            providers.map((p) => (
              <Row key={p.provider} label={p.provider === "vk" ? "VK" : "Discord"}>
                <span className="flex items-center justify-end gap-2">
                  <span className="truncate text-neutral-300">{p.username ?? "Connected"}</span>
                  <Badge tone="ok" dot>
                    Linked
                  </Badge>
                </span>
              </Row>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Sign out" description="End this session or revoke every active session." />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              loading={pendingSignOut}
              onClick={() => void signOut()}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
            <Button variant="danger" onClick={() => setConfirmAll(true)}>
              <MonitorSmartphone className="h-3.5 w-3.5" /> Sign out of all devices
            </Button>
          </div>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmAll}
        loading={pendingAll}
        request={{
          title: "Sign out of all devices?",
          description:
            "Every active session for your account — including this one — will be revoked and you will be returned to the sign-in page.",
          confirmLabel: "Sign out everywhere",
          danger: true,
        }}
        onConfirm={() => void signOutAll()}
        onCancel={() => setConfirmAll(false)}
      />
    </div>
  );
}
