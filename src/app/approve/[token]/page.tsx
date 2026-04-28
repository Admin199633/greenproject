import { buildPublicDocumentPdfPath } from "@/lib/documents/delivery";
import { createPublicPdfToken } from "@/lib/documents/public-pdf";
import { formatCurrency, formatDate } from "@/lib/utils";
import { findQuoteByApprovalToken } from "@/services/document.service";
import ApprovalForm from "./ApprovalForm";
import QuoteTermsModal from "./QuoteTermsModal";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

function parseItemDescription(description: string) {
  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { title: "שירות", bullets: [] as string[] };
  }

  const normalizeBullet = (value: string) =>
    value.replace(/^[•·*\-]+\s*/, "").trim();

  const [firstLine, ...rest] = lines;
  const title = normalizeBullet(firstLine) || "שירות";
  const bullets = rest.flatMap((line) => {
    const parts = line
      .split(/\s*[•·]\s*/g)
      .map((part) => normalizeBullet(part))
      .filter(Boolean);

    return parts.length > 0 ? parts : [normalizeBullet(line)].filter(Boolean);
  });

  return { title, bullets };
}

function InvalidTokenView() {
  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[linear-gradient(180deg,#f8f3ee_0%,#f8fafc_52%,#ffffff_100%)] px-4 py-10"
    >
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center">
        <section className="w-full rounded-[2rem] border border-white/70 bg-white/90 p-8 text-center shadow-[0_24px_90px_rgba(15,23,42,0.09)] ring-1 ring-slate-200/70 backdrop-blur">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <span className="text-xl">?</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            לא נמצאה הצעת מחיר
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            קישור האישור אינו תקין או שאינו זמין.
          </p>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            יש לפנות לעסק שהפיק את ההצעה לקבלת קישור עדכני.
          </p>
        </section>
      </div>
    </main>
  );
}

function DetailTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e7ddd2] bg-[#fffdfa] px-4 py-4 shadow-[0_10px_30px_rgba(148,163,184,0.08)]">
      <p className="text-[11px] font-medium tracking-[0.18em] text-[#9a7b5c]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-7 text-slate-800">
        {value}
      </p>
    </div>
  );
}

export default async function ApprovePage({ params }: PageProps) {
  const { token } = await params;
  const doc = await findQuoteByApprovalToken(token);

  if (!doc || !doc.issuedHash) {
    return <InvalidTokenView />;
  }

  const pdfToken = createPublicPdfToken(doc.id, doc.issuedHash);
  const pdfHref = buildPublicDocumentPdfPath(doc.id, pdfToken);
  const business = doc.business;
  const customerName =
    doc.customerName?.trim() ||
    doc.customer.companyName?.trim() ||
    doc.customer.fullName?.trim() ||
    "לקוח/ה";
  const businessAddressLine = [business.address, business.city, business.postalCode]
    .filter((part) => part && part.trim())
    .join(", ");
  const isApproved = Boolean(doc.approvedAt);
  const detailTiles = [
    { label: "לקוח", value: customerName },
    ...(doc.customerEmail ? [{ label: "אימייל", value: doc.customerEmail }] : []),
    ...(doc.customer.phone ? [{ label: "טלפון", value: doc.customer.phone }] : []),
    ...(doc.eventDate ? [{ label: "תאריך האירוע", value: formatDate(doc.eventDate) }] : []),
    ...(doc.eventTime ? [{ label: "שעת האירוע", value: doc.eventTime }] : []),
    ...(doc.eventLocation ? [{ label: "מיקום האירוע", value: doc.eventLocation }] : []),
  ];

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f6efe8_0%,#f8f5f1_18%,#fbfcfd_46%,#ffffff_100%)] px-3 py-6 sm:px-4 sm:py-10"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_right,#fff9f3_0%,#fffdfa_34%,#ffffff_100%)] shadow-[0_28px_110px_rgba(15,23,42,0.10)] ring-1 ring-[#eadfd3]">
          <div className="border-b border-[#efe5da] bg-[linear-gradient(135deg,rgba(255,248,240,0.98)_0%,rgba(255,255,255,0.9)_60%,rgba(249,244,237,0.96)_100%)] px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-medium tracking-[0.24em] text-[#9a7b5c]">
                  BOUTIQUE PROPOSAL
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  {business.name}
                </h1>
                <p className="mt-3 text-base leading-8 text-slate-600">
                  הצעת מחיר
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
                <div className="rounded-2xl border border-[#ece1d5] bg-white/80 px-4 py-4 shadow-[0_10px_30px_rgba(148,163,184,0.08)]">
                  <p className="text-[11px] font-medium tracking-[0.18em] text-[#9a7b5c]">
                    מספר הצעה
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {doc.number ?? "—"}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#ece1d5] bg-white/80 px-4 py-4 shadow-[0_10px_30px_rgba(148,163,184,0.08)]">
                  <p className="text-[11px] font-medium tracking-[0.18em] text-[#9a7b5c]">
                    תאריך הנפקה
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {doc.issueDate ? formatDate(doc.issueDate) : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
              {business.phone && (
                <span className="rounded-full border border-[#ece1d5] bg-white/70 px-4 py-2">
                  טלפון: {business.phone}
                </span>
              )}
              {business.email && (
                <span className="break-all rounded-full border border-[#ece1d5] bg-white/70 px-4 py-2">
                  אימייל: {business.email}
                </span>
              )}
              {businessAddressLine && (
                <span className="rounded-full border border-[#ece1d5] bg-white/70 px-4 py-2">
                  כתובת: {businessAddressLine}
                </span>
              )}
              {business.taxId && (
                <span className="rounded-full border border-[#ece1d5] bg-white/70 px-4 py-2">
                  ע"מ / ח.פ: {business.taxId}
                </span>
              )}
            </div>
          </div>

          <div className="px-5 py-5 sm:px-8 sm:py-6">
            {isApproved && doc.approvedAt ? (
              <div className="rounded-[1.75rem] border border-emerald-200/80 bg-[linear-gradient(135deg,#f3fbf7_0%,#fbfffd_100%)] px-5 py-5 shadow-[0_16px_45px_rgba(16,185,129,0.10)]">
                <p className="text-[11px] font-medium tracking-[0.22em] text-emerald-700">
                  APPROVED
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                  הצעת המחיר אושרה
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {doc.approvedByName
                    ? `אושרה על ידי ${doc.approvedByName} בתאריך ${formatDate(doc.approvedAt)}`
                    : `אושרה בתאריך ${formatDate(doc.approvedAt)}`}
                </p>
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-[#e8dece] bg-[#fffaf4] px-5 py-5 shadow-[0_12px_36px_rgba(148,163,184,0.08)]">
                <p className="text-[11px] font-medium tracking-[0.22em] text-[#9a7b5c]">
                  לפני האישור
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  נא לעבור על פרטי ההצעה ולאשר בתחתית העמוד.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#efe3d8] bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.07)] ring-1 ring-white/70 sm:p-8">
          <div className="mb-5">
            <p className="text-[11px] font-medium tracking-[0.22em] text-[#9a7b5c]">
              פרטי ההצעה
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              פרטי הלקוח והאירוע
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {detailTiles.map((item) => (
              <DetailTile key={`${item.label}-${item.value}`} {...item} />
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
          <div className="space-y-5">
            {doc.items.map((item, index) => {
              const parsed = parseItemDescription(item.description);
              const sectionLabel =
                index === 0 ? "החבילה שנבחרה" : "שירות נוסף";

              return (
                <section
                  key={item.id}
                  className="rounded-[2rem] border border-[#efe3d8] bg-[linear-gradient(180deg,#fffefc_0%,#fffaf6_100%)] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)] ring-1 ring-white/80 sm:p-7"
                >
                  <div className="max-w-3xl">
                    <p className="text-[11px] font-medium tracking-[0.22em] text-[#9a7b5c]">
                      {sectionLabel}
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold leading-tight text-slate-900 sm:text-[2rem]">
                      {parsed.title}
                    </h2>
                  </div>

                  {parsed.bullets.length > 0 && (
                    <ul className="mt-6 space-y-3">
                      {parsed.bullets.map((bullet, bulletIndex) => (
                        <li
                          key={`${item.id}-bullet-${bulletIndex}`}
                          className="flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-[0_10px_24px_rgba(148,163,184,0.08)] ring-1 ring-[#f1e7dc]"
                        >
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#b68a62]" />
                          <span className="text-sm leading-7 text-slate-700">
                            {bullet}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-7 rounded-[1.5rem] border border-[#eadfd3] bg-white px-4 py-4 shadow-[0_14px_40px_rgba(148,163,184,0.08)] sm:px-5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-[#fcf6f0] px-4 py-3">
                        <p className="text-xs text-[#9a7b5c]">כמות</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {item.quantity.toString()}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#fcf6f0] px-4 py-3">
                        <p className="text-xs text-[#9a7b5c]">מחיר יחידה</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {formatCurrency(item.unitPrice.toString())}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#f6efe8] px-4 py-3">
                        <p className="text-xs text-[#9a7b5c]">סה"כ לחבילה</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {formatCurrency(item.totalAmount.toString())}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}

            {doc.quoteTermsText?.trim() && (
              <QuoteTermsModal
                termsText={doc.quoteTermsText}
                triggerVariant="card"
              />
            )}
          </div>

          <aside className="space-y-5">
            <section className="rounded-[2rem] border border-[#eadfd3] bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)] ring-1 ring-white/70 sm:p-7">
              <p className="text-[11px] font-medium tracking-[0.22em] text-[#9a7b5c]">
                קובץ ההצעה
              </p>
              <h2 className="mt-3 text-xl font-semibold text-slate-900">
                צפייה במסמך המקורי
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                ניתן לצפות או להוריד את קובץ ה-PDF המקורי של ההצעה בכל שלב.
              </p>
              <a
                href={pdfHref}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-[#d8c3ad] bg-[linear-gradient(180deg,#fffaf5_0%,#fff3e7_100%)] px-4 text-sm font-semibold text-slate-800 shadow-[0_16px_40px_rgba(182,138,98,0.14)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#fff5eb]"
              >
                צפייה / הורדת PDF
              </a>
            </section>
          </aside>
        </section>

        {!isApproved && (
          <ApprovalForm
            token={token}
            customerName={customerName}
            termsText={doc.quoteTermsText}
          />
        )}

        <p className="px-2 pb-4 text-center text-xs leading-7 text-slate-400">
          באישור ההצעה הנך מאשר/ת את פרטיה ואת התנאים המופיעים בה.
        </p>
      </div>
    </main>
  );
}
