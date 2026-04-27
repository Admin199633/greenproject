import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  if (!process.env.NEXTAUTH_SECRET) {
    console.error("[auth] missing NEXTAUTH_SECRET");
    return NextResponse.json(
      { error: "Server auth is not configured" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "נתונים שגויים" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;

  const user = await db.user.findUnique({
    where: { email },
    include: { business: true },
  });

  if (!user) {
    return NextResponse.json({ error: "אימייל או סיסמה שגויים" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "אימייל או סיסמה שגויים" }, { status: 401 });
  }

  const token = await encode({
    token: {
      sub: user.id,
      id: user.id,
      name: user.name ?? undefined,
      email: user.email,
      businessId: user.business?.id ?? null,
    },
    secret: process.env.NEXTAUTH_SECRET!,
  });

  const secure = process.env.NODE_ENV === "production";
  const cookieName = secure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
