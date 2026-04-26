/**
 * Audit log service — append-only, never throws.
 *
 * Rule: logging must NEVER break the main flow.
 * All public functions are fire-and-forget wrappers: errors are swallowed and
 * logged to console.error only.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type AuditAction =
  | "create"
  | "issue"
  | "cancel"
  | "payment_add"
  | "payment_delete";

type EntityType = "document" | "payment" | "customer";

interface AuditParams {
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  businessId: string;
  userId?: string | null;
  payload: Prisma.InputJsonObject;
}

async function writeAuditLog(params: AuditParams): Promise<void> {
  await db.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      businessId: params.businessId,
      userId: params.userId ?? null,
      payload: params.payload,
    },
  });
}

/** Safe wrapper — never throws, logs errors to console.error. */
function audit(params: AuditParams): void {
  writeAuditLog(params).catch((err) => {
    console.error("[audit]", params.action, params.entityType, params.entityId, err);
  });
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export function auditDocumentCreate(
  doc: { id: string; businessId: string; type: string; customerId: string },
  userId?: string | null
): void {
  audit({
    entityType: "document",
    entityId: doc.id,
    action: "create",
    businessId: doc.businessId,
    userId,
    payload: { type: doc.type, customerId: doc.customerId },
  });
}

export function auditDocumentIssue(
  doc: { id: string; businessId: string; number: string | null; type: string },
  userId?: string | null
): void {
  audit({
    entityType: "document",
    entityId: doc.id,
    action: "issue",
    businessId: doc.businessId,
    userId,
    payload: { number: doc.number, type: doc.type },
  });
}

export function auditDocumentCancel(
  doc: { id: string; businessId: string; number: string | null; type: string },
  userId?: string | null
): void {
  audit({
    entityType: "document",
    entityId: doc.id,
    action: "cancel",
    businessId: doc.businessId,
    userId,
    payload: { number: doc.number, type: doc.type },
  });
}

export function auditPaymentAdd(
  payment: {
    id: string;
    businessId: string;
    documentId: string;
    amount: string | number;
    method: string;
  },
  userId?: string | null
): void {
  audit({
    entityType: "payment",
    entityId: payment.id,
    action: "payment_add",
    businessId: payment.businessId,
    userId,
    payload: {
      documentId: payment.documentId,
      amount: String(payment.amount),
      method: payment.method,
    },
  });
}

export function auditPaymentDelete(
  payment: {
    id: string;
    businessId: string;
    documentId: string;
    amount: string | number;
    method: string;
  },
  userId?: string | null
): void {
  audit({
    entityType: "payment",
    entityId: payment.id,
    action: "payment_delete",
    businessId: payment.businessId,
    userId,
    payload: {
      documentId: payment.documentId,
      amount: String(payment.amount),
      method: payment.method,
    },
  });
}
