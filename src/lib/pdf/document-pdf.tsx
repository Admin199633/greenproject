import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type {
  Business,
  Customer,
  Document as PrismaDocument,
  DocumentItem,
  Payment,
} from "@prisma/client";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/validations/payment";
import { join } from "node:path";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  type DocumentStatusValue,
  type DocumentTypeValue,
} from "@/lib/validations/document";

const EMPTY_VALUE = "—";

// Full-coverage TTF fonts (Hebrew + Latin + digits + ₪).
// The @fontsource/heebo WOFF files are Unicode-range subsets designed for
// browsers; they only contain Hebrew block glyphs and cannot render digits
// or punctuation. We use the static TTF instances from Google Fonts CDN
// stored in public/fonts/ so every character renders correctly.
const heeboRegularPath = join(process.cwd(), "public", "fonts", "Heebo-Regular.ttf");
const heeboBoldPath    = join(process.cwd(), "public", "fonts", "Heebo-Bold.ttf");

Font.register({
  family: "HeeboPdf",
  fonts: [
    { src: heeboRegularPath, fontWeight: 400 },
    { src: heeboBoldPath,    fontWeight: 700 },
  ],
});

const BRAND_COLOR = "#1e40af";

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingHorizontal: 36,
    paddingBottom: 44,
    fontFamily: "HeeboPdf",
    fontSize: 10,
    color: "#0f172a",
    // direction: "rtl" is NOT applied at page level — @react-pdf/renderer
    // requires it on individual Text elements. We use textAlign: "right" on
    // all text styles instead, which is the correct approach for RTL PDFs.
  },
  // Accent bar at top of page
  accentBar: {
    height: 4,
    backgroundColor: BRAND_COLOR,
    marginHorizontal: -36,
    marginBottom: 20,
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  headerBlock: {
    flexBasis: "48%",
  },
  // Logo at top-right of business block
  logoWrapper: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  logo: {
    width: 100,
    height: 48,
    objectFit: "contain",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    textAlign: "right",
    color: BRAND_COLOR,
    marginBottom: 4,
  },
  documentNumber: {
    fontSize: 11,
    textAlign: "right",
    color: "#334155",
    marginBottom: 2,
  },
  subtle: {
    color: "#475569",
    textAlign: "right",
    lineHeight: 1.4,
  },
  businessName: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: "right",
    marginBottom: 4,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textAlign: "right",
    marginBottom: 6,
    color: BRAND_COLOR,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  twoCols: {
    flexDirection: "row-reverse",
    gap: 20,
  },
  col: {
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 7,
  },
  fieldLabel: {
    color: "#64748b",
    fontSize: 8,
    textAlign: "right",
    marginBottom: 1,
    textTransform: "uppercase",
  },
  fieldValue: {
    textAlign: "right",
    lineHeight: 1.45,
  },
  table: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 2,
  },
  tableHeader: {
    flexDirection: "row-reverse",
    backgroundColor: BRAND_COLOR,
    borderBottomWidth: 1,
    borderBottomColor: "#1e3a8a",
  },
  tableHeaderText: {
    color: "#ffffff",
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  cell: {
    paddingVertical: 8,
    paddingHorizontal: 7,
    textAlign: "right",
    lineHeight: 1.4,
    borderLeftWidth: 1,
    borderLeftColor: "#e2e8f0",
  },
  headerCell: {
    fontWeight: 700,
  },
  descriptionCell: {
    width: "34%",
  },
  mediumCell: {
    width: "13.2%",
  },
  totals: {
    width: 240,
    marginLeft: 0,
    marginRight: "auto",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 2,
  },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  totalRowFinal: {
    backgroundColor: "#f0f9ff",
    borderBottomWidth: 0,
  },
  totalLabel: {
    textAlign: "right",
    color: "#475569",
  },
  totalValue: {
    textAlign: "left",
  },
  totalStrong: {
    fontWeight: 700,
    color: "#0f172a",
    fontSize: 11,
  },
  notesBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 2,
  },
  notesText: {
    textAlign: "right",
    lineHeight: 1.5,
  },
  // Payment details section (RECEIPT / INVOICE_RECEIPT only)
  paymentRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  paymentRowAlt: {
    backgroundColor: "#f8fafc",
  },
  paymentCell: {
    textAlign: "right",
    flex: 1,
  },
  paymentSummaryRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "#f0f9ff",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
  },
  // Page footer with page numbers
  footer: {
    position: "absolute",
    bottom: 14,
    left: 36,
    right: 36,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: "#94a3b8",
  },
});

type PdfDocumentData = PrismaDocument & {
  items: DocumentItem[];
  customer: Customer;
  payments: Payment[];
};

interface BuildPdfInput {
  business: Pick<Business, "name" | "taxId" | "address" | "logo" | "phone" | "email">;
  document: PdfDocumentData;
}

// Use "en-US" locale to avoid Unicode Bidi control characters (U+200F, U+202B,
// etc.) that "he-IL" injects and that @react-pdf/renderer renders as visible
// glyphs. The ₪ symbol (U+20AA) is appended/handled manually.
function formatCurrency(amount: string | number) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return EMPTY_VALUE;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${formatted} \u20AA`;
}

function formatDate(date: Date | string | null) {
  if (!date) return EMPTY_VALUE;
  // Use "en-GB" (DD/MM/YYYY) — clean LTR digits, no Bidi marks.
  return new Intl.DateTimeFormat("en-GB").format(new Date(date));
}

function formatPercent(amount: string | number) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return EMPTY_VALUE;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: parsed % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(parsed);
  return `${formatted}%`;
}

function formatQuantity(amount: string | number) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return EMPTY_VALUE;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(parsed);
}

function valueOrDash(value: string | null | undefined) {
  return value?.trim() || EMPTY_VALUE;
}

function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method;
}

function customerDisplayName(customer: Pick<Customer, "fullName" | "companyName">) {
  if (customer.companyName && customer.fullName) {
    return `${customer.companyName} - ${customer.fullName}`;
  }

  return customer.companyName || customer.fullName || EMPTY_VALUE;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldGroup} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function PdfTemplate({ business, document }: BuildPdfInput) {
  const businessName = valueOrDash(document.businessName ?? business.name);
  const businessTaxId = valueOrDash(document.businessTaxId ?? business.taxId);
  const businessAddress = valueOrDash(document.businessAddress ?? business.address);

  const customerName = valueOrDash(
    document.customerName ?? customerDisplayName(document.customer)
  );
  const customerTaxId = valueOrDash(document.customerTaxId ?? document.customer.taxId);
  const customerAddress = valueOrDash(document.customerAddress ?? document.customer.address);
  const customerEmail = valueOrDash(document.customerEmail ?? document.customer.email);

  const typeLabel =
    DOCUMENT_TYPE_LABELS[document.type as DocumentTypeValue] ?? document.type;
  const statusLabel =
    DOCUMENT_STATUS_LABELS[document.status as DocumentStatusValue] ?? document.status;

  return (
    <Document
      title={document.number ?? document.id}
      author={businessName}
      language="he-IL"
    >
      <Page size="A4" style={styles.page}>
        {/* Top accent bar */}
        <View style={styles.accentBar} fixed />

        {/* Header */}
        <View style={styles.header}>
          {/* Left block: document title + number */}
          <View style={styles.headerBlock}>
            <Text style={styles.title}>{typeLabel}</Text>
            <Text style={styles.documentNumber}>
              {document.number ?? document.id}
            </Text>
            <Text style={styles.subtle}>{statusLabel}</Text>
            <Text style={[styles.subtle, { marginTop: 4 }]}>
              {formatDate(document.issueDate)}
            </Text>
          </View>

          {/* Right block: logo + business details */}
          <View style={styles.headerBlock}>
            {business.logo ? (
              <View style={styles.logoWrapper}>
                <Image style={styles.logo} src={business.logo} />
              </View>
            ) : null}
            <Text style={styles.businessName}>{businessName}</Text>
            <Text style={styles.subtle}>{businessTaxId}</Text>
            <Text style={styles.subtle}>{businessAddress}</Text>
            {business.phone ? (
              <Text style={styles.subtle}>{business.phone}</Text>
            ) : null}
            {business.email ? (
              <Text style={styles.subtle}>{business.email}</Text>
            ) : null}
          </View>
        </View>

        {/* Photography quote fields — rendered when present */}
        {(document.eventDate || document.eventLocation || document.eventHours != null || document.eventTime) && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>פרטי האירוע</Text>
            <View style={styles.twoCols}>
              {document.eventDate ? (
                <View style={styles.col}>
                  <Field label="תאריך האירוע" value={formatDate(document.eventDate)} />
                </View>
              ) : null}
              {document.eventLocation ? (
                <View style={styles.col}>
                  <Field label="מיקום" value={document.eventLocation} />
                </View>
              ) : null}
              {document.eventTime ? (
                <View style={styles.col}>
                  <Field label="שעת האירוע" value={document.eventTime} />
                </View>
              ) : null}
              {document.eventHours != null ? (
                <View style={styles.col}>
                  <Field label="שעות צילום" value={document.eventHours.toString()} />
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Customer + Document details */}
        <View style={[styles.section, styles.twoCols]}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>פרטי לקוח</Text>
            <Field label="שם" value={customerName} />
            <Field label="ח.פ. / ע״מ" value={customerTaxId} />
            <Field label="כתובת" value={customerAddress} />
            <Field label="אימייל" value={customerEmail} />
          </View>

          <View style={styles.col}>
            <Text style={styles.sectionTitle}>פרטי מסמך</Text>
            <Field label="מספר" value={document.number ?? document.id} />
            <Field label="סוג" value={typeLabel} />
            <Field label="סטטוס" value={statusLabel} />
            <Field label="תאריך הנפקה" value={formatDate(document.issueDate)} />
            <Field label="תאריך תשלום" value={formatDate(document.dueDate)} />
          </View>
        </View>

        {/* Items table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>פריטים</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text
                style={[styles.cell, styles.tableHeaderText, styles.descriptionCell]}
              >
                תיאור
              </Text>
              <Text style={[styles.cell, styles.tableHeaderText, styles.mediumCell]}>
                כמות
              </Text>
              <Text style={[styles.cell, styles.tableHeaderText, styles.mediumCell]}>
                מחיר יחידה
              </Text>
              <Text style={[styles.cell, styles.tableHeaderText, styles.mediumCell]}>
                הנחה
              </Text>
              <Text style={[styles.cell, styles.tableHeaderText, styles.mediumCell]}>
                שיעור מע״מ
              </Text>
              <Text style={[styles.cell, styles.tableHeaderText, styles.mediumCell]}>
                סה״כ
              </Text>
            </View>

            {document.items.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.tableRow,
                  idx % 2 === 1 ? styles.tableRowAlt : {},
                ]}
                wrap={false}
              >
                <Text style={[styles.cell, styles.descriptionCell]}>
                  {item.description}
                </Text>
                <Text style={[styles.cell, styles.mediumCell]}>
                  {formatQuantity(item.quantity.toString())}
                </Text>
                <Text style={[styles.cell, styles.mediumCell]}>
                  {formatCurrency(item.unitPrice.toString())}
                </Text>
                <Text style={[styles.cell, styles.mediumCell]}>
                  {Number(item.discountAmount) > 0
                    ? formatCurrency(item.discountAmount.toString())
                    : EMPTY_VALUE}
                </Text>
                <Text style={[styles.cell, styles.mediumCell]}>
                  {formatPercent(item.taxRate.toString())}
                </Text>
                <Text style={[styles.cell, styles.mediumCell]}>
                  {formatCurrency(item.totalAmount.toString())}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Payment details — shown only for RECEIPT and INVOICE_RECEIPT */}
        {(document.type === "RECEIPT" || document.type === "INVOICE_RECEIPT") &&
          document.payments.length > 0 && (
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>פרטי תשלום</Text>
              <View style={styles.table}>
                {/* Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.cell, styles.tableHeaderText, { flex: 1 }]}>
                    תאריך
                  </Text>
                  <Text style={[styles.cell, styles.tableHeaderText, { flex: 1 }]}>
                    אמצעי תשלום
                  </Text>
                  <Text style={[styles.cell, styles.tableHeaderText, { flex: 1 }]}>
                    אסמכתא
                  </Text>
                  <Text style={[styles.cell, styles.tableHeaderText, { flex: 1 }]}>
                    סכום
                  </Text>
                </View>
                {document.payments.map((payment, idx) => (
                  <View
                    key={payment.id}
                    style={[
                      styles.paymentRow,
                      idx % 2 === 1 ? styles.paymentRowAlt : {},
                    ]}
                  >
                    <Text style={styles.paymentCell}>
                      {formatDate(payment.paymentDate)}
                    </Text>
                    <Text style={styles.paymentCell}>
                      {paymentMethodLabel(payment.method)}
                    </Text>
                    <Text style={styles.paymentCell}>
                      {payment.reference ?? EMPTY_VALUE}
                    </Text>
                    <Text style={styles.paymentCell}>
                      {formatCurrency(payment.amount.toString())}
                    </Text>
                  </View>
                ))}
                {/* Total paid summary row */}
                <View style={styles.paymentSummaryRow}>
                  <Text style={[styles.totalLabel, styles.totalStrong]}>
                    סה״כ התקבל
                  </Text>
                  <Text style={[styles.totalValue, styles.totalStrong]}>
                    {formatCurrency(document.amountPaid.toString())}
                  </Text>
                </View>
              </View>
            </View>
          )}

        {/* Totals */}
        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>סכום לפני מע״מ</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(document.subtotalAmount.toString())}
            </Text>
          </View>
          {Number(document.vatRateSnapshot) > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>מע״מ ({document.vatRateSnapshot.toString()}%)</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(document.taxAmount.toString())}
              </Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.totalStrong]}>סה״כ</Text>
            <Text style={[styles.totalValue, styles.totalStrong]}>
              {formatCurrency(document.totalAmount.toString())}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>שולם</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(document.amountPaid.toString())}
            </Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={[styles.totalLabel, styles.totalStrong]}>יתרה לתשלום</Text>
            <Text style={[styles.totalValue, styles.totalStrong]}>
              {formatCurrency(document.amountDue.toString())}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {document.notes ? (
          <View style={styles.notesBox} wrap={false}>
            <Text style={styles.sectionTitle}>הערות</Text>
            <Text style={styles.notesText}>{document.notes}</Text>
          </View>
        ) : null}

        {/* Footer with page numbers */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{businessName}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderDocumentPdf(input: BuildPdfInput) {
  return renderToBuffer(<PdfTemplate {...input} />);
}
