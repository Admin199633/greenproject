import { NextResponse } from "next/server";

export async function POST() {
  const secure = process.env.NODE_ENV === "production";
  const cookieName = secure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
