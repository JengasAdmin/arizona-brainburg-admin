import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { departmentOfUser } from "@/server/services/scope";
import { updateProfile } from "@/server/services/users";

const schema = z.object({
  displayName: z.string().trim().min(2).max(64).optional(),
  nickname: z.string().trim().max(64).nullable().optional(),
  branch: z.string().trim().max(120).nullable().optional(),
  gameId: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z_-]{1,32}$/, "Game ID должен состоять из 1–32 буквенно-цифровых символов.")
    .nullable()
    .optional(),
});

/** PATCH /api/users/:id — edit profile data (scoped supervisors stay in scope). */
export const PATCH = guard(
  {
    method: "PATCH",
    auth: true,
    permission: "EDIT_PROFILES",
    schema,
    scope: async ({ params }) => ({ departmentId: await departmentOfUser(Number(params.id)) }),
  },
  async ({ params, body, auth, req }) => {
    const updated = await updateProfile(Number(params.id), body, auth.actor, getClientIp(req));
    return NextResponse.json({ user: { id: updated.id } });
  },
);
