import { NextResponse } from "next/server";
import { requireBusiness } from "@/services/auth.service";
import { createDocumentFromQuote } from "@/services/document.service";

type RouteCtx = { params: Promise<{ id: string }> };

const SUPPORTED_TARGET_TYPES = new Set([
  "INVOICE",
  "RECEIPT",
  "INVOICE_RECEIPT",
] as const);

export async function POST(req: Request, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const business = await requireBusiness();
    const body = (await req.json().catch(() => ({}))) as { targetType?: string };
    const targetType = body.targetType;

    if (!targetType || !SUPPORTED_TARGET_TYPES.has(targetType as never)) {
      return NextResponse.json({ error: "סוג מסמך לא תקין" }, { status: 400 });
    }

    if (targetType === "INVOICE_RECEIPT" && business.taxType === "osek_patur") {
      return NextResponse.json(
        { error: "חשבונית קבלה אינה נתמכת עבור עוסק פטור" },
        { status: 400 }
      );
    }

    const doc = await createDocumentFromQuote(
      id,
      business.id,
      targetType as "INVOICE" | "RECEIPT" | "INVOICE_RECEIPT"
    );

    return NextResponse.json({ id: doc.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאת שרת";
    const status =
      message === "Document not found"
        ? 404
        : message.includes("Only issued quotes") ||
          message.includes("Only quotes can")
        ? 400
        : 500;

    console.error("[documents:create-from-quote] failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
