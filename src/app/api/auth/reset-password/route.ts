import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashResetToken } from "@/lib/auth/password-reset";

const schema = z
  .object({
    token: z.string().min(1, "קישור האיפוס חסר"),
    password: z.string().min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
    confirmPassword: z.string().min(1, "יש לאשר את הסיסמה"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirmPassword"],
  });

const INVALID_TOKEN_MESSAGE =
  "הקישור לא תקין או שתוקפו פג. יש לבקש קישור חדש.";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "נתונים שגויים" },
      { status: 400 }
    );
  }

  const tokenHash = hashResetToken(parsed.data.token);
  const now = new Date();

  try {
    const user = await db.user.findFirst({
      where: {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: { gt: now },
      },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: INVALID_TOKEN_MESSAGE },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    // updateMany with the hash + expiry guard ensures the token is single-use
    // even under concurrent submissions: the second update finds 0 rows.
    const updated = await db.user.updateMany({
      where: {
        id: user.id,
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: { gt: now },
      },
      data: {
        passwordHash,
        resetPasswordTokenHash: null,
        resetPasswordExpiresAt: null,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: INVALID_TOKEN_MESSAGE },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth:reset-password] failed", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
