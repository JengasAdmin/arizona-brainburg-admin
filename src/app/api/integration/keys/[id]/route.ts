import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { revokeIntegrationKey } from "@/server/services/integration";

/** DELETE /api/integration/keys/:id — disable an API key. */
export const DELETE = guard(
  { method: "DELETE", auth: true, permission: "MANAGE_INTEGRATION" },
  async ({ params, auth, req }) => {
    return NextResponse.json(
      await revokeIntegrationKey(Number(params.id), auth.actor, getClientIp(req)),
    );
  },
);
