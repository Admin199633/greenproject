import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { listSavedItems, createSavedItem } from "@/services/savedItem.service";
import { savedItemSchema } from "@/lib/validations/savedItem";

function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "Unauthorized") {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }
  if (message === "No business associated with this account") {
    return NextResponse.json(
      { error: "החשבון אינו משויך לעסק. צא והתחבר מחדש כדי ליצור עסק ברירת מחדל." },
      { status: 409 }
    );
  }
  return null;
}

export async function GET() {
  try {
    const business = await requireBusiness();
    const items = await listSavedItems(business.id);
    return NextResponse.json(items);
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    console.error("[settings:saved-items] failed", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const business = await requireBusiness();
    const body = await req.json();
    const parsed = savedItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "נתונים לא תקינים", errors: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }
    const item = await createSavedItem(business.id, parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    console.error("[settings:saved-items] failed", error);
    const detail = error instanceof Error ? error.message : "שגיאת שרת";
    return NextResponse.json({ error: "שגיאה בשמירה", detail }, { status: 500 });
  }
}
