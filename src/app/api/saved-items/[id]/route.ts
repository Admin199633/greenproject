import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { updateSavedItem, deleteSavedItem } from "@/services/savedItem.service";
import { savedItemSchema } from "@/lib/validations/savedItem";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();
    const body = await req.json();
    const parsed = savedItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
    }
    const item = await updateSavedItem(id, business.id, parsed.data);
    if (!item) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    return NextResponse.json(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";
    if (message === "Unauthorized") return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    if (message === "No business associated with this account") return NextResponse.json({ error: "לא נמצא עסק" }, { status: 403 });
    console.error("[PATCH /api/saved-items/:id]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();
    const item = await deleteSavedItem(id, business.id);
    if (!item) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";
    if (message === "Unauthorized") return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
    if (message === "No business associated with this account") return NextResponse.json({ error: "לא נמצא עסק" }, { status: 403 });
    console.error("[DELETE /api/saved-items/:id]", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
