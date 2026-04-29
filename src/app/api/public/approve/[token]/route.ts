import { NextResponse } from "next/server";
import { z } from "zod";
import { recordQuoteApproval } from "@/services/document.service";

type RouteCtx = { params: Promise<{ token: string }> };

const SAFE_INVALID_TOKEN_MESSAGE = "קישור האישור אינו תקין או שאינו זמין";
const MAX_SIGNATURE_DATA_URL_LENGTH = 300_000;
const SIGNATURE_DATA_URL_PATTERN =
  /^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;

const bodySchema = z.object({
  approvedByName: z
    .string()
    .trim()
    .min(2, "יש להזין שם מלא")
    .max(120, "שם מלא ארוך מדי"),
  termsAccepted: z.literal(true).optional(),
  signatureDataUrl: z
    .string()
    .trim()
    .max(MAX_SIGNATURE_DATA_URL_LENGTH, "החתימה גדולה מדי")
    .refine(
      (value) => SIGNATURE_DATA_URL_PATTERN.test(value),
      "פורמט החתימה לא תקין"
    )
    .optional(),
});

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  return req.headers.get("x-real-ip") || null;
}

export async function POST(req: Request, { params }: RouteCtx) {
  try {
    const { token } = await params;

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "בקשה לא תקינה" },
        { status: 400 }
      );
    }

    const result = await recordQuoteApproval(token, {
      approvedByName: parsed.data.approvedByName,
      approvalIp: getClientIp(req),
      approvalUserAgent: req.headers.get("user-agent"),
      approvalSignatureDataUrl: parsed.data.signatureDataUrl,
    });

    return NextResponse.json({
      approvedAt: result.approvedAt,
      approvedByName: result.approvedByName,
      calendarEventCreated: result.calendarEventCreated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.startsWith("APPROVAL:")) {
      const detail = message.slice("APPROVAL:".length);

      if (detail === "Already approved") {
        return NextResponse.json(
          { error: "הצעת המחיר כבר אושרה", code: "ALREADY_APPROVED" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: SAFE_INVALID_TOKEN_MESSAGE, code: "INVALID" },
        { status: 404 }
      );
    }

    console.error("[approve] unexpected error", error);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
