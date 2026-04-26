import { NextResponse } from "next/server";
import { requireSession } from "@/services/auth.service";

export async function GET() {
  try {
    const user = await requireSession();
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      businessId: user.businessId ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
