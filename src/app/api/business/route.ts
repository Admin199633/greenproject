import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { businessSchema } from "@/lib/validations/business";
import { getBusiness, updateBusiness } from "@/services/business.service";

export async function GET() {
  try {
    const business = await requireBusiness();
    const data = await getBusiness(business.id);
    if (!data) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET /api/business]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const business = await requireBusiness();
    const body = await req.json();

    const parsed = businessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const updated = await updateBusiness(business.id, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/business]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
