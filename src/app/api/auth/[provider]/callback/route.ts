import type { NextRequest } from "next/server";
import { completeOAuth } from "@/server/auth/oauth/flow";
import { isProviderKey } from "@/server/auth/oauth/providers";
import { errors, errorResponse } from "@/server/http";

/** GET /api/auth/:provider/callback - OAuth redirect target. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await params;
    if (!isProviderKey(provider)) throw errors.notFound("Unknown OAuth provider.");

    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    return await completeOAuth({ req, provider, code, stateParam: state });
  } catch (err) {
    // Corrupted state cookie, rate limit, etc. — never surface an unhandled 500 page.
    return errorResponse(err);
  }
}
