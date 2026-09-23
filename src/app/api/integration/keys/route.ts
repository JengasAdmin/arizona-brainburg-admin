import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import {
  createIntegrationKey,
  createKeySchema,
  listIntegrationKeys,
} from "@/server/services/integration";

/** GET /api/integration/keys — list provisioned API keys (hashes only). */
export const GET = guard(
  { method: "GET", auth: true, permission: "VIEW_INTEGRATION", rateLimit: RATE_LIMITS.read },
  async () => {
    return NextResponse.json({ items: await listIntegrationKeys() });
  },
);

/** POST /api/integration/keys — create a key; plaintext returned exactly once. */
export const POST = guard(
  {
    method: "POST",
    auth: true,
    permission: "MANAGE_INTEGRATION",
    schema: createKeySchema,
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
  async ({ body, auth, req }) => {
    const result = await createIntegrationKey(body, auth.actor, getClientIp(req));
    return NextResponse.json(result, { status: 201 });
  },
);
