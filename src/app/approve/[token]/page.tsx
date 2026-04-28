import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { buildPublicDocumentPdfPath } from "@/lib/documents/delivery";
import { createPublicPdfToken } from "@/lib/documents/public-pdf";
import { formatCurrency, formatDate } from "@/lib/utils";
import { findQuoteByApprovalToken } from "@/services/document.service";
import ApprovalForm from "./ApprovalForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

function InvalidTokenView() {
  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl text-slate-800">
            לא נמצאה הצעת מחיר
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm leading-relaxed text-slate-600">
          <p>קישור האישור אינו תקין או שאינו זמין</p>
          <p className="text-xs text-slate-500">
            יש לפנות לעסק שהפיק את ההצעה לקבלת קישור עדכני.
          </p>
        </CardContent>
      </Card>
    </main>
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

  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-slate-50 px-3 py-6 sm:px-4 sm:py-10"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            הצעת מחיר
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            {business.name}
          </h1>
          <dl className="mt-3 grid grid-cols-1 gap-y-1 text-sm text-slate-600 sm:grid-cols-2 sm:gap-x-6">
            {business.phone && (
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-slate-500">טלפון</dt>
                <dd className="font-medium text-slate-700">{business.phone}</dd>
              </div>
            )}
            {business.email && (
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-slate-500">אימייל</dt>
                <dd className="break-words font-medium text-slate-700">
                  {business.email}
                </dd>
              </div>
            )}
            {businessAddressLine && (
              <div className="flex justify-between gap-3 sm:col-span-2 sm:block">
                <dt className="text-slate-500">כתובת</dt>
                <dd className="font-medium text-slate-700">{businessAddressLine}</dd>
              </div>
            )}
            {business.taxId && (
              <div className="flex justify-between gap-3 sm:block">
                <dt className="text-slate-500">ע"מ / ח.פ</dt>
                <dd className="font-medium text-slate-700">{business.taxId}</dd>
              </div>
            )}
          </dl>
        </header>

        {isApproved && doc.approvedAt && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="space-y-1 p-5 text-center sm:p-6">
              <p className="text-base font-semibold text-emerald-800">
                הצעת המחיר כבר אושרה
              </p>
              <p className="text-sm text-emerald-700">
                {doc.approvedByName
                  ? `אושרה על ידי ${doc.approvedByName} בתאריך ${formatDate(doc.approvedAt)}`
                  : `אושרה בתאריך ${formatDate(doc.approvedAt)}`}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">פרטי ההצעה</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">מספר הצעה</dt>
                <dd className="mt-0.5 font-semibold text-slate-800">
                  {doc.number ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">תאריך הנפקה</dt>
                <dd className="mt-0.5 font-semibold text-slate-800">
                  {doc.issueDate ? formatDate(doc.issueDate) : "—"}
                </dd>
              </div>
              {doc.dueDate && (
                <div>
                  <dt className="text-slate-500">בתוקף עד</dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">
                    {formatDate(doc.dueDate)}
                  </dd>
                </div>
              )}
              <div className="col-span-2 border-t border-slate-100 pt-3 sm:col-span-3">
                <dt className="text-slate-500">לקוח</dt>
                <dd className="mt-0.5 font-semibold text-slate-800">{customerName}</dd>
              </div>
              {doc.customerEmail && (
                <div>
                  <dt className="text-slate-500">אימייל לקוח</dt>
                  <dd className="mt-0.5 break-words text-slate-800">
                    {doc.customerEmail}
                  </dd>
                </div>
              )}
              {doc.customer.phone && (
                <div>
                  <dt className="text-slate-500">טלפון לקוח</dt>
                  <dd className="mt-0.5 text-slate-800">{doc.customer.phone}</dd>
                </div>
              )}
              {doc.eventDate && (
                <div>
                  <dt className="text-slate-500">תאריך האירוע</dt>
                  <dd className="mt-0.5 text-slate-800">
                    {formatDate(doc.eventDate)}
                  </dd>
                </div>
              )}
              {doc.eventLocation && (
                <div className="col-span-2 sm:col-span-2">
                  <dt className="text-slate-500">מיקום האירוע</dt>
                  <dd className="mt-0.5 text-slate-800">{doc.eventLocation}</dd>
                </div>
              )}
              {doc.eventTime && (
                <div>
                  <dt className="text-slate-500">שעת האירוע</dt>
                  <dd className="mt-0.5 text-slate-800">{doc.eventTime}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">פירוט שירותים ופריטים</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {doc.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-slate-800">
                      {item.description}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      כמות: {item.quantity.toString()} · מחיר יחידה:{" "}
                      {formatCurrency(item.unitPrice.toString())}
                    </p>
                  </div>
                  <div className="shrink-0 text-left tabular-nums">
                    <p className="text-base font-semibold text-slate-900">
                      {formatCurrency(item.totalAmount.toString())}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">סה"כ לפני מע"מ</span>
                <span className="text-sm font-medium tabular-nums text-slate-700">
                  {formatCurrency(doc.subtotalAmount.toString())}
                </span>
              </div>
              {Number(doc.vatRateSnapshot) > 0 && (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    מע"מ ({doc.vatRateSnapshot.toString()}%)
                  </span>
                  <span className="text-sm font-medium tabular-nums text-slate-700">
                    {formatCurrency(doc.taxAmount.toString())}
                  </span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="text-base font-semibold text-slate-900">
                  סה"כ לתשלום
                </span>
                <span className="text-xl font-bold tabular-nums text-emerald-700">
                  {formatCurrency(doc.totalAmount.toString())}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {doc.quoteTermsText?.trim() && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">תנאים והערות</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {doc.quoteTermsText}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">קובץ PDF</p>
              <p className="mt-0.5 text-xs text-slate-500">
                ניתן להוריד או לצפות במסמך המקורי בפורמט PDF.
              </p>
            </div>
            <Link
              href={pdfHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              צפייה / הורדה
            </Link>
          </CardContent>
        </Card>

        {!isApproved && <ApprovalForm token={token} customerName={customerName} />}

        <p className="px-1 pb-4 text-center text-xs text-slate-400">
          באישור ההצעה הנך מאשר/ת את פרטיה ואת התנאים המופיעים בה.
        </p>
      </div>
    </main>
  );
}
