/**
 * Pure calculation functions for document totals.
 * Safe for use in both server and client contexts — no Prisma imports.
 *
 * Decimal strategy: money inputs are converted to integer cents immediately.
 * All arithmetic runs on integers; Math.round is applied only at division
 * boundaries (never after addition or subtraction). This prevents the
 * floating-point accumulation errors that occur when rounding after each
 * float operation.
 */

export interface ItemCalcInput {
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  vatRate: number; // e.g. 17 for 17%
  isTaxInclusive: boolean;
}

export interface ItemCalcResult {
  subtotalAmount: number; // pre-VAT amount
  taxAmount: number;
  totalAmount: number;
}

export interface DocTotals {
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountDue: number;
}

/** Convert a decimal number to integer cents (rounds half-up). */
function toCents(n: number): number {
  return Math.round(n * 100);
}

/** Convert integer cents back to a 2dp decimal number. */
function fromCents(c: number): number {
  return c / 100;
}

/**
 * Calculate per-item amounts given raw inputs.
 *
 * Money values (unitPrice, discountAmount) are converted to cents before
 * any multiplication so that intermediate products are integers.
 * The only non-integer step is the VAT division, which uses a single
 * Math.round on the final quotient.
 */
export function calcItem(input: ItemCalcInput): ItemCalcResult {
  const { quantity, unitPrice, discountAmount, vatRate, isTaxInclusive } = input;

  const pCents = toCents(unitPrice);
  const dCents = toCents(discountAmount);

  // Multiply quantity (up to 3dp) by unitPrice in cents, round once to cents.
  // Discount is already in cents — integer subtraction, no rounding needed.
  const grossCents = Math.round(quantity * pCents) - dCents;

  if (isTaxInclusive) {
    // Price already includes VAT: taxAmount = gross * rate / (100 + rate)
    const taxCents = Math.round((grossCents * vatRate) / (100 + vatRate));
    const subCents = grossCents - taxCents;
    return {
      subtotalAmount: fromCents(subCents),
      taxAmount: fromCents(taxCents),
      totalAmount: fromCents(grossCents),
    };
  } else {
    // Price excludes VAT: taxAmount = subtotal * rate / 100
    const taxCents = Math.round((grossCents * vatRate) / 100);
    const totalCents = grossCents + taxCents;
    return {
      subtotalAmount: fromCents(grossCents),
      taxAmount: fromCents(taxCents),
      totalAmount: fromCents(totalCents),
    };
  }
}

/**
 * Aggregate item results into document-level totals.
 * Each component is summed in integer cents to prevent accumulation drift.
 * amountPaid defaults to 0 (all drafts have 0 paid).
 */
export function calcDocTotals(
  items: ItemCalcResult[],
  amountPaid = 0
): DocTotals {
  const subCents = items.reduce((s, i) => s + toCents(i.subtotalAmount), 0);
  const taxCents = items.reduce((s, i) => s + toCents(i.taxAmount), 0);
  const totalCents = items.reduce((s, i) => s + toCents(i.totalAmount), 0);
  const paidCents = toCents(amountPaid);

  return {
    subtotalAmount: fromCents(subCents),
    taxAmount: fromCents(taxCents),
    totalAmount: fromCents(totalCents),
    amountDue: fromCents(totalCents - paidCents),
  };
}
