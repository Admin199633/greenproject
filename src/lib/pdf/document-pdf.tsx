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

// ─── Theme tokens ────────────────────────────────────────────────────────────

const BRAND_COLOR = "#1e40af";
const BRAND_TINT  = "#eef2ff";
const INK         = "#0f172a";
const INK_MUTED   = "#475569";
const INK_SUBTLE  = "#94a3b8";
const DIVIDER     = "#e2e8f0";

// ─── Text sanitisation ───────────────────────────────────────────────────────
//
// Pasted Hebrew text frequently carries invisible Bidi / zero-width / C0
// control codepoints. @react-pdf/renderer can render some of these as visible
// glyph smears (the "Ž=" artefact reported in production). We strip them
// from every user-supplied string before it reaches the canvas, while
// preserving tabs and newlines so multi-line item descriptions still split.
const INVISIBLE_CONTROL_RE = new RegExp(
  "[" +
    "\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F" + // C0 except \t \n
    "\\u007F-\\u009F" +                                  // DEL + C1
    "\\u00AD" +                                          // soft hyphen
    "\\u200B-\\u200F" +                                  // zero-width + LRM/RLM
    "\\u202A-\\u202E" +                                  // explicit Bidi controls
    "\\u2060-\\u2064" +                                  // word-joiner family
    "\\u2066-\\u2069" +                                  // isolate controls
    "\\uFEFF" +                                          // BOM / ZWNBSP
  "]",
  "g"
);

function sanitizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(INVISIBLE_CONTROL_RE, "").trim();
}

function safeOrDash(value: string | null | undefined): string {
  return sanitizeText(value) || EMPTY_VALUE;
}

// A description may be a single title, or a title + a few lines of details.
// The quote layout shows the title in bold and the rest as muted body.
function splitDescription(raw: string | null | undefined) {
  const cleaned = sanitizeText(raw);
  if (!cleaned) return { title: EMPTY_VALUE, body: "" };
  const [first, ...rest] = cleaned.split(/\r?\n/);
  return { title: first.trim() || EMPTY_VALUE, body: rest.join("\n").trim() };
}

// Quote items are presented as a card: bold title + bulleted body. We strip
// trailing colons from the title (a common typing pattern: "חבילת גולד:")
// and normalise bullet prefixes ("- foo", "• foo", "* foo", "· foo", "✓ foo")
// so they all render with our own consistent bullet glyph.
const TRAILING_COLON_RE = /[:：׃]+\s*$/;
const LEADING_BULLET_RE = /^[\s•·◦●⁃\-\*✓✔]+\s*/;

function parseQuoteItem(raw: string | null | undefined) {
  const { title, body } = splitDescription(raw);
  const cleanTitle = title.replace(TRAILING_COLON_RE, "").trim() || EMPTY_VALUE;
  const bullets = body
    ? body
        .split(/\r?\n/)
        .map((line) => line.replace(LEADING_BULLET_RE, "").trim())
        .filter((line) => line.length > 0)
    : [];
  return { title: cleanTitle, bullets };
}

// ─── Shared (legacy) styles for non-quote document types ─────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingHorizontal: 36,
    paddingBottom: 44,
    fontFamily: "HeeboPdf",
    fontSize: 10,
    color: INK,
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
    color: INK_MUTED,
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
    borderBottomColor: DIVIDER,
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
    borderBottomColor: DIVIDER,
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
    borderLeftColor: DIVIDER,
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
    borderColor: DIVIDER,
    borderRadius: 2,
  },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
  },
  totalRowFinal: {
    backgroundColor: "#f0f9ff",
    borderBottomWidth: 0,
  },
  totalLabel: {
    textAlign: "right",
    color: INK_MUTED,
  },
  totalValue: {
    textAlign: "left",
  },
  totalStrong: {
    fontWeight: 700,
    color: INK,
    fontSize: 11,
  },
  notesBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: DIVIDER,
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
    borderBottomColor: DIVIDER,
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
    borderTopColor: DIVIDER,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: INK_SUBTLE,
  },
});

// ─── Quote-specific premium styles ───────────────────────────────────────────

const quote = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingHorizontal: 44,
    paddingBottom: 56,
    fontFamily: "HeeboPdf",
    fontSize: 10,
    color: INK,
  },
  accentBar: {
    height: 6,
    backgroundColor: BRAND_COLOR,
    marginHorizontal: -44,
  },
  // Header row: business identity on the right (RTL-primary side),
  // document title + meta on the left.
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  headerRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  headerLeft: {
    flex: 1,
    alignItems: "flex-start",
  },
  logoWrapper: {
    marginBottom: 10,
  },
  logo: {
    width: 110,
    height: 44,
    objectFit: "contain",
  },
  businessName: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: "right",
    color: INK,
    marginBottom: 4,
  },
  businessMeta: {
    fontSize: 9,
    color: INK_MUTED,
    textAlign: "right",
    lineHeight: 1.5,
  },
  // Document title block (left side of header)
  eyebrow: {
    fontSize: 8,
    color: INK_SUBTLE,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "left",
    marginBottom: 6,
  },
  hero: {
    fontSize: 30,
    fontWeight: 700,
    color: BRAND_COLOR,
    textAlign: "left",
    lineHeight: 1.1,
    marginBottom: 8,
  },
  heroMeta: {
    fontSize: 10,
    color: INK_MUTED,
    textAlign: "left",
    lineHeight: 1.5,
  },
  heroMetaStrong: {
    color: INK,
    fontWeight: 700,
  },
  // Thin brand rule under the header
  rule: {
    height: 1,
    backgroundColor: DIVIDER,
    marginBottom: 22,
  },
  // Card row holding customer + event side-by-side
  cardRow: {
    flexDirection: "row-reverse",
    gap: 14,
    marginBottom: 22,
  },
  card: {
    flex: 1,
    backgroundColor: BRAND_TINT,
    borderRadius: 6,
    padding: 14,
  },
  cardEyebrow: {
    fontSize: 8,
    color: BRAND_COLOR,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "right",
    marginBottom: 8,
    fontWeight: 700,
  },
  cardField: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#dbeafe",
  },
  cardFieldLast: {
    borderBottomWidth: 0,
  },
  cardLabel: {
    fontSize: 9,
    color: INK_MUTED,
    textAlign: "right",
  },
  cardValue: {
    fontSize: 10,
    color: INK,
    textAlign: "left",
    fontWeight: 700,
    flex: 1,
    paddingLeft: 8,
  },
  // Section heading
  sectionEyebrow: {
    fontSize: 9,
    color: BRAND_COLOR,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "right",
    marginBottom: 10,
    fontWeight: 700,
  },
  // Service "card" — each item is presented as a small boutique block:
  // eyebrow → bold title → bulleted body → divider → labeled price summary.
  itemCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: DIVIDER,
    borderRadius: 8,
    padding: 18,
    marginBottom: 12,
  },
  itemEyebrow: {
    fontSize: 8,
    color: BRAND_COLOR,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    textAlign: "right",
    marginBottom: 4,
    fontWeight: 700,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: INK,
    textAlign: "right",
    lineHeight: 1.25,
    marginBottom: 14,
  },
  bulletList: {
    marginTop: 2,
  },
  bulletRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    paddingVertical: 3,
  },
  bulletDot: {
    fontSize: 11,
    color: BRAND_COLOR,
    textAlign: "right",
    width: 14,
    lineHeight: 1.55,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    color: INK_MUTED,
    textAlign: "right",
    lineHeight: 1.55,
    paddingRight: 2,
  },
  priceDivider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginTop: 14,
    marginBottom: 12,
  },
  priceSummary: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
  },
  priceCell: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 8,
    color: INK_SUBTLE,
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "right",
    marginBottom: 3,
  },
  priceLabelEnd: {
    textAlign: "left",
  },
  priceValue: {
    fontSize: 11,
    fontWeight: 700,
    color: INK,
    textAlign: "right",
  },
  priceValueEnd: {
    textAlign: "left",
  },
  priceTotalValue: {
    fontSize: 13,
    color: BRAND_COLOR,
  },
  // Totals — right side aligned (RTL primary), final row emphasised
  totalsWrap: {
    marginTop: 18,
    flexDirection: "row-reverse",
    justifyContent: "flex-start",
  },
  totalsBlock: {
    width: 260,
  },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  totalLabel: {
    fontSize: 10,
    color: INK_MUTED,
    textAlign: "right",
  },
  totalValue: {
    fontSize: 10,
    color: INK,
    textAlign: "left",
  },
  totalDivider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginVertical: 4,
  },
  finalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 6,
    backgroundColor: BRAND_COLOR,
    borderRadius: 6,
  },
  finalLabel: {
    fontSize: 11,
    color: "#ffffff",
    textAlign: "right",
    fontWeight: 700,
  },
  finalValue: {
    fontSize: 16,
    color: "#ffffff",
    textAlign: "left",
    fontWeight: 700,
  },
  notesWrap: {
    marginTop: 22,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
  },
  notesEyebrow: {
    fontSize: 9,
    color: BRAND_COLOR,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "right",
    marginBottom: 6,
    fontWeight: 700,
  },
  notesText: {
    textAlign: "right",
    lineHeight: 1.6,
    color: INK,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 44,
    right: 44,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
  },
  footerText: {
    fontSize: 8,
    color: INK_SUBTLE,
  },
});

type PdfDocumentData = PrismaDocument & {
  items: DocumentItem[];
  customer: Customer;
  payments: Payment[];
};

interface BuildPdfInput {
  business: Pick<
    Business,
    "name" | "taxId" | "address" | "logo" | "phone" | "email" | "taxType"
  >;
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
  return `${formatted} ₪`;
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
  return safeOrDash(value);
}

function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method;
}

function getPdfDocumentTypeLabel(type: string, taxType?: string | null) {
  if (taxType === "osek_patur") {
    if (type === "INVOICE") return "חשבונית";
    if (type === "INVOICE_RECEIPT") return "חשבונית / קבלה";
  }

  return DOCUMENT_TYPE_LABELS[type as DocumentTypeValue] ?? type;
}

function paymentDetailsValue(
  payment: Pick<
    Payment,
    | "reference"
    | "checkNumber"
    | "checkBank"
    | "checkBranch"
    | "checkAccount"
    | "checkDueDate"
  >
) {
  const parts = [
    payment.reference ? `אסמכתא: ${sanitizeText(payment.reference)}` : "",
    payment.checkNumber ? `שיק: ${sanitizeText(payment.checkNumber)}` : "",
    payment.checkBank ? `בנק: ${sanitizeText(payment.checkBank)}` : "",
    payment.checkBranch ? `סניף: ${sanitizeText(payment.checkBranch)}` : "",
    payment.checkAccount ? `חשבון: ${sanitizeText(payment.checkAccount)}` : "",
    payment.checkDueDate ? `פירעון: ${formatDate(payment.checkDueDate)}` : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : EMPTY_VALUE;
}

function customerDisplayName(customer: Pick<Customer, "fullName" | "companyName">) {
  const company = sanitizeText(customer.companyName);
  const full = sanitizeText(customer.fullName);
  if (company && full) return `${company} - ${full}`;
  return company || full || EMPTY_VALUE;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldGroup} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

// ─── Quote (premium) layout ──────────────────────────────────────────────────

function QuotePage({ business, document }: BuildPdfInput) {
  const businessName = safeOrDash(document.businessName ?? business.name);
  const businessTaxId = safeOrDash(document.businessTaxId ?? business.taxId);
  const businessAddress = safeOrDash(document.businessAddress ?? business.address);
  const businessPhone = sanitizeText(business.phone);
  const businessEmail = sanitizeText(business.email);

  const customerName = safeOrDash(
    document.customerName ?? customerDisplayName(document.customer)
  );
  const customerEmail = safeOrDash(document.customerEmail ?? document.customer.email);
  // Phone has no snapshot field — pull from current customer record.
  const customerPhone = safeOrDash(document.customer.phone);

  const eventLocation = sanitizeText(document.eventLocation);
  const eventDate = document.eventDate ? formatDate(document.eventDate) : "";
  const eventTime = sanitizeText(document.eventTime);
  const hasEvent = Boolean(eventLocation || eventDate || eventTime);

  const docNumber = safeOrDash(document.number ?? document.id);
  const issueDate = formatDate(document.issueDate);

  const vatRate = Number(document.vatRateSnapshot);
  const showVat = Number.isFinite(vatRate) && vatRate > 0;

  return (
    <Page size="A4" style={quote.page}>
      <View style={quote.accentBar} fixed />

      {/* Header */}
      <View style={quote.header}>
        <View style={quote.headerRight}>
          {business.logo ? (
            <View style={quote.logoWrapper}>
              <Image style={quote.logo} src={business.logo} />
            </View>
          ) : null}
          <Text style={quote.businessName}>{businessName}</Text>
          {businessTaxId !== EMPTY_VALUE ? (
            <Text style={quote.businessMeta}>{businessTaxId}</Text>
          ) : null}
          {businessAddress !== EMPTY_VALUE ? (
            <Text style={quote.businessMeta}>{businessAddress}</Text>
          ) : null}
          {businessPhone ? (
            <Text style={quote.businessMeta}>{businessPhone}</Text>
          ) : null}
          {businessEmail ? (
            <Text style={quote.businessMeta}>{businessEmail}</Text>
          ) : null}
        </View>

        <View style={quote.headerLeft}>
          <Text style={quote.eyebrow}>QUOTE</Text>
          <Text style={quote.hero}>הצעת מחיר</Text>
          <Text style={quote.heroMeta}>
            <Text style={quote.heroMetaStrong}>{docNumber}</Text>
          </Text>
          <Text style={quote.heroMeta}>{issueDate}</Text>
        </View>
      </View>

      <View style={quote.rule} />

      {/* Customer + Event cards */}
      <View style={quote.cardRow}>
        <View style={quote.card}>
          <Text style={quote.cardEyebrow}>פרטי לקוח</Text>
          <View style={quote.cardField}>
            <Text style={quote.cardLabel}>שם לקוח</Text>
            <Text style={quote.cardValue}>{customerName}</Text>
          </View>
          <View style={quote.cardField}>
            <Text style={quote.cardLabel}>אימייל</Text>
            <Text style={quote.cardValue}>{customerEmail}</Text>
          </View>
          <View style={[quote.cardField, quote.cardFieldLast]}>
            <Text style={quote.cardLabel}>טלפון</Text>
            <Text style={quote.cardValue}>{customerPhone}</Text>
          </View>
        </View>

        {hasEvent ? (
          <View style={quote.card}>
            <Text style={quote.cardEyebrow}>פרטי האירוע</Text>
            <View style={quote.cardField}>
              <Text style={quote.cardLabel}>מיקום</Text>
              <Text style={quote.cardValue}>{eventLocation || EMPTY_VALUE}</Text>
            </View>
            <View style={quote.cardField}>
              <Text style={quote.cardLabel}>תאריך</Text>
              <Text style={quote.cardValue}>{eventDate || EMPTY_VALUE}</Text>
            </View>
            <View style={[quote.cardField, quote.cardFieldLast]}>
              <Text style={quote.cardLabel}>שעה</Text>
              <Text style={quote.cardValue}>{eventTime || EMPTY_VALUE}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Items — one boutique card per service */}
      <Text style={quote.sectionEyebrow}>פירוט השירותים</Text>

      {document.items.map((item) => {
        const { title, bullets } = parseQuoteItem(item.description);
        return (
          <View key={item.id} style={quote.itemCard} wrap={false}>
            <Text style={quote.itemEyebrow}>שירות נבחר</Text>
            <Text style={quote.itemTitle}>{title}</Text>

            {bullets.length > 0 ? (
              <View style={quote.bulletList}>
                {bullets.map((line, idx) => (
                  <View
                    key={`${item.id}-bullet-${idx}`}
                    style={quote.bulletRow}
                  >
                    <Text style={quote.bulletDot}>•</Text>
                    <Text style={quote.bulletText}>{line}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={quote.priceDivider} />

            <View style={quote.priceSummary}>
              <View style={quote.priceCell}>
                <Text style={quote.priceLabel}>כמות</Text>
                <Text style={quote.priceValue}>
                  {formatQuantity(item.quantity.toString())}
                </Text>
              </View>
              <View style={quote.priceCell}>
                <Text style={quote.priceLabel}>מחיר ליחידה</Text>
                <Text style={quote.priceValue}>
                  {formatCurrency(item.unitPrice.toString())}
                </Text>
              </View>
              <View style={quote.priceCell}>
                <Text style={[quote.priceLabel, quote.priceLabelEnd]}>
                  סה&quot;כ
                </Text>
                <Text
                  style={[
                    quote.priceValue,
                    quote.priceValueEnd,
                    quote.priceTotalValue,
                  ]}
                >
                  {formatCurrency(item.totalAmount.toString())}
                </Text>
              </View>
            </View>
          </View>
        );
      })}

      {/* Totals */}
      <View style={quote.totalsWrap} wrap={false}>
        <View style={quote.totalsBlock}>
          <View style={quote.totalRow}>
            <Text style={quote.totalLabel}>סכום לפני מע&quot;מ</Text>
            <Text style={quote.totalValue}>
              {formatCurrency(document.subtotalAmount.toString())}
            </Text>
          </View>
          {showVat ? (
            <View style={quote.totalRow}>
              <Text style={quote.totalLabel}>
                מע&quot;מ ({formatPercent(document.vatRateSnapshot.toString())})
              </Text>
              <Text style={quote.totalValue}>
                {formatCurrency(document.taxAmount.toString())}
              </Text>
            </View>
          ) : null}
          <View style={quote.totalDivider} />
          <View style={quote.finalRow}>
            <Text style={quote.finalLabel}>סה&quot;כ לתשלום</Text>
            <Text style={quote.finalValue}>
              {formatCurrency(document.totalAmount.toString())}
            </Text>
          </View>
        </View>
      </View>

      {/* Notes */}
      {sanitizeText(document.notes) ? (
        <View style={quote.notesWrap} wrap={false}>
          <Text style={quote.notesEyebrow}>הערות</Text>
          <Text style={quote.notesText}>{sanitizeText(document.notes)}</Text>
        </View>
      ) : null}

      <View style={quote.footer} fixed>
        <Text style={quote.footerText}>{businessName}</Text>
        <Text
          style={quote.footerText}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </View>
    </Page>
  );
}

// ─── Legacy layout (invoice / receipt / credit-note / invoice-receipt) ───────

function LegacyPage({ business, document }: BuildPdfInput) {
  const businessName = valueOrDash(document.businessName ?? business.name);
  const businessTaxId = valueOrDash(document.businessTaxId ?? business.taxId);
  const businessAddress = valueOrDash(document.businessAddress ?? business.address);

  const customerName = valueOrDash(
    document.customerName ?? customerDisplayName(document.customer)
  );
  const customerPhone = valueOrDash(document.customer.phone);
  const customerTaxId = valueOrDash(document.customerTaxId ?? document.customer.taxId);
  const customerAddress = valueOrDash(document.customerAddress ?? document.customer.address);
  const customerEmail = valueOrDash(document.customerEmail ?? document.customer.email);

  const typeLabel = getPdfDocumentTypeLabel(document.type, business.taxType);
  const statusLabel =
    DOCUMENT_STATUS_LABELS[document.status as DocumentStatusValue] ?? document.status;

  return (
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
            <Text style={styles.subtle}>{sanitizeText(business.phone)}</Text>
          ) : null}
          {business.email ? (
            <Text style={styles.subtle}>{sanitizeText(business.email)}</Text>
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
                <Field label="מיקום" value={sanitizeText(document.eventLocation)} />
              </View>
            ) : null}
            {document.eventTime ? (
              <View style={styles.col}>
                <Field label="שעת האירוע" value={sanitizeText(document.eventTime)} />
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
          <Field label="טלפון" value={customerPhone} />
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
                {sanitizeText(item.description)}
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
                    {paymentDetailsValue(payment)}
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
          <Text style={styles.notesText}>{sanitizeText(document.notes)}</Text>
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
  );
}

function PdfTemplate(input: BuildPdfInput) {
  const { business, document } = input;
  const businessName = safeOrDash(document.businessName ?? business.name);

  return (
    <Document
      title={document.number ?? document.id}
      author={businessName}
      language="he-IL"
    >
      {document.type === "QUOTE" ? (
        <QuotePage {...input} />
      ) : (
        <LegacyPage {...input} />
      )}
    </Document>
  );
}

export async function renderDocumentPdf(input: BuildPdfInput) {
  return renderToBuffer(<PdfTemplate {...input} />);
}
