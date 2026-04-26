import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { listSavedItems, createSavedItem } from "@/services/savedItem.service";
import { savedItemSchema } from "@/lib/validations/savedItem";

export async function GET() {
  try {
    const business = await requireBusiness();
    const items = await listSavedItems(business.id);
    return NextResponse.json(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";
    if (message === "Unauthorized") return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    if (message === "No business associated with this account") return NextResponse.json({ error: "לא נמצא עסק" }, { status: 403 });
    console.error("[GET /api/saved-items]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const business = await requireBusiness();
    const body = await req.json();
    const parsed = savedItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
    }
    const item = await createSavedItem(business.id, parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";
    if (message === "Unauthorized") return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    if (message === "No business associated with this account") return NextResponse.json({ error: "לא נמצא עסק" }, { status: 403 });
    console.error("[POST /api/saved-items]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
