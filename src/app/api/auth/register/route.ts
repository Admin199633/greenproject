import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const registerSchema = z
  .object({
    email: z.string().trim().email("כתובת אימייל לא תקינה"),
    password: z.string().min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
    confirmPassword: z.string().min(1, "יש לאשר את הסיסמה"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirmPassword"],
  });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "נתונים שגויים" },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  const { password } = parsed.data;

  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "קיים כבר חשבון עם כתובת האימייל הזו" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.create({
    data: {
      email,
      passwordHash,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
