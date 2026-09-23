import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { departmentOfUser } from "@/server/services/scope";
import { verifyGameId } from "@/server/services/users";

const schema = z.object({
  verified: z.boolean(),
  reason: z.string().trim().min(3).max(500).optional(),
});

/** POST /api/users/:id/game-id — verify or revoke a Game ID (administrator action). */
export const POST = guard(
  {
    method: "POST",
    auth: true,
    permission: "VERIFY_GAME_ID",
    schema,
    scope: async ({ params }) => ({ departmentId: await departmentOfUser(Number(params.id)) }),
  },
  async ({ params, body, auth, req }) => {
    const updated = await verifyGameId(Number(params.id), body, auth.actor, getClientIp(req));
    return NextResponse.json({
      user: { id: updated.id, gameId: updated.gameId, verified: Boolean(updated.gameIdVerifiedAt) },
    });
  },
);
