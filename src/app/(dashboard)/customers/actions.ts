"use server";

import { redirect } from "next/navigation";
import { requireBusiness } from "@/services/auth.service";
import { customerSchema } from "@/lib/validations/customer";
import {
  createCustomer,
  updateCustomer,
  deactivateCustomer,
} from "@/services/customer.service";

export type FormState = {
  errors?: Record<string, string[]>;
  message?: string;
} | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFormData(formData: FormData) {
  return {
    fullName: (formData.get("fullName") as string) ?? "",
    companyName: (formData.get("companyName") as string) ?? "",
    email: (formData.get("email") as string) ?? "",
    phone: (formData.get("phone") as string) ?? "",
    address: (formData.get("address") as string) ?? "",
    taxId: (formData.get("taxId") as string) ?? "",
    notes: (formData.get("notes") as string) ?? "",
  };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createCustomerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const business = await requireBusiness();
  const parsed = customerSchema.safeParse(parseFormData(formData));

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await createCustomer(business.id, parsed.data);
  redirect("/customers");
}

/**
 * Bind the customer id before passing to useActionState:
 *   const action = updateCustomerAction.bind(null, customer.id)
 */
export async function updateCustomerAction(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const business = await requireBusiness();
  const parsed = customerSchema.safeParse(parseFormData(formData));

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await updateCustomer(id, business.id, parsed.data);
  redirect(`/customers/${id}`);
}

export async function deactivateCustomerAction(
  id: string
): Promise<{ error?: string }> {
  const business = await requireBusiness();

  try {
    await deactivateCustomer(id, business.id);
  } catch {
    return { error: "לא ניתן לבטל לקוח זה" };
  }

  redirect("/customers");
}
