import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { businessSchema } from "@/lib/validations/business";
import { getBusiness, updateBusiness } from "@/services/business.service";

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
    const data = await getBusiness(business.id);
    if (!data) {
      return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    console.error("[settings:business] failed", error);
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
    const auth = authErrorResponse(error);
    if (auth) return auth;
    console.error("[settings:business] failed", error);
    const detail = error instanceof Error ? error.message : "שגיאת שרת";
    return NextResponse.json({ error: "שגיאת שרת", detail }, { status: 500 });
  }
}
