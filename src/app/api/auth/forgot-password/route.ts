import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  RESET_TOKEN_TTL_MS,
  buildResetUrl,
  generateResetToken,
  sendPasswordResetEmail,
} from "@/lib/auth/password-reset";

const schema = z.object({
  email: z.string().trim().email("כתובת אימייל לא תקינה"),
});

const GENERIC_MESSAGE =
  "אם קיים חשבון עם כתובת זו, נשלח אליו קישור לאיפוס סיסמה.";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  // Always return the same generic response regardless of the request body so
  // the endpoint never reveals whether an account exists for a given address.
  if (!parsed.success) {
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  const email = parsed.data.email.toLowerCase();

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (user) {
      const { rawToken, tokenHash } = generateResetToken();
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await db.user.update({
        where: { id: user.id },
        data: {
          resetPasswordTokenHash: tokenHash,
          resetPasswordExpiresAt: expiresAt,
        },
      });

      const origin = req.headers.get("origin");
      const resetUrl = buildResetUrl(rawToken, origin);

      try {
        await sendPasswordResetEmail({ email: user.email, resetUrl });
      } catch (error) {
        // Do not surface the failure to the caller — keep the response generic.
        // Log without including the token or URL.
        console.error("[auth:forgot-password] email send failed", error);
      }
    }
  } catch (error) {
    console.error("[auth:forgot-password] failed", error);
  }

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
