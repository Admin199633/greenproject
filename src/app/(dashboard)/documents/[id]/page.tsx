import { notFound } from "next/navigation";
import Link from "next/link";
import { requireBusiness } from "@/services/auth.service";
import { getDocumentById } from "@/services/document.service";
import { getDisplayName } from "@/services/customer.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  DocumentTypeBadge,
  DocumentStatusBadge,
} from "@/components/documents/DocumentStatusBadge";
import DeleteDraftButton from "@/components/documents/DeleteDraftButton";
import IssueDraftButton from "@/components/documents/IssueDraftButton";
import CancelDocumentButton from "@/components/documents/CancelDocumentButton";
import CreateCreditNoteButton from "@/components/documents/CreateCreditNoteButton";
import DuplicateDocumentButton from "@/components/documents/DuplicateDocumentButton";
import DocumentShareActions from "@/components/documents/DocumentShareActions";
import AddPaymentForm from "@/components/payments/AddPaymentForm";
import DeletePaymentButton from "@/components/payments/DeletePaymentButton";
import { createPublicPdfToken } from "@/lib/documents/public-pdf";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/validations/payment";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const business = await requireBusiness();
  const doc = await getDocumentById(id, business.id);

  if (!doc) notFound();

  const isDraft = doc.status === "DRAFT";
  const canCancelDocument = doc.status === "ISSUED" && doc.amountPaid.eq(0);
  const canCreateCreditNote =
    !doc.sourceDocument &&
    !doc.creditNote &&
    (doc.type === "INVOICE" || doc.type === "INVOICE_RECEIPT") &&
    (doc.status === "ISSUED" ||
      doc.status === "PARTIALLY_PAID" ||
      doc.status === "PAID");
  const canDownloadPdf = !isDraft && doc.status !== "CANCELLED" && Boolean(doc.issuedHash);
  const publicPdfToken = doc.issuedHash
    ? createPublicPdfToken(doc.id, doc.issuedHash)
    : null;
  const canAddPayment =
    !isDraft &&
    doc.type !== "QUOTE" &&
    doc.type !== "CREDIT_NOTE" &&
    doc.status !== "CANCELLED" &&
    doc.status !== "PAID" &&
    doc.amountDue.gt(0);

  return (
    <div className="mx-auto max-w-4xl space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">
              {doc.number ? `מסמך ${doc.number}` : "טיוטה"}
            </h2>
            <DocumentTypeBadge type={doc.type} />
            <DocumentStatusBadge status={doc.status} />
          </div>
          <p className="text-sm text-slate-500">
            {isDraft ? getDisplayName(doc.customer) : doc.customerName ?? "—"}
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
          {isDraft ? (
            <>
              <IssueDraftButton documentId={doc.id} />
              <Link
                href={`/documents/${doc.id}/edit`}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:min-h-8 sm:px-3 lg:w-auto"
              >
                עריכה
              </Link>
              <DuplicateDocumentButton documentId={doc.id} />
              <DeleteDraftButton documentId={doc.id} />
            </>
          ) : (
            <>
              {canDownloadPdf && publicPdfToken && (
                <DocumentShareActions
                  documentId={doc.id}
                  customerName={doc.customerName ?? getDisplayName(doc.customer)}
                  customerEmail={doc.customerEmail ?? doc.customer.email}
                  customerPhone={doc.customer.phone}
                  documentType={doc.type}
                  documentNumber={doc.number ?? doc.id}
                  publicPdfToken={publicPdfToken}
                  totalAmountFormatted={formatCurrency(doc.totalAmount.toString())}
                />
              )}
              <DuplicateDocumentButton documentId={doc.id} />
              {canCreateCreditNote && <CreateCreditNoteButton documentId={doc.id} />}
              {canCancelDocument && <CancelDocumentButton documentId={doc.id} />}
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>פרטי המסמך</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {[
              {
                label: "לקוח",
                value: isDraft ? getDisplayName(doc.customer) : doc.customerName ?? "—",
              },
              {
                label: "תאריך הנפקה",
                value: doc.issueDate ? formatDate(doc.issueDate) : "—",
              },
              {
                label: "תאריך תשלום",
                value: doc.dueDate ? formatDate(doc.dueDate) : "—",
              },
              { label: "מטבע", value: doc.currency },
              {
                label: 'מחירים כוללים מע"מ',
                value: doc.isTaxInclusive ? "כן" : "לא",
              },
              {
                label: 'שיעור מע"מ',
                value: `${doc.vatRateSnapshot.toString()}%`,
              },
              ...(doc.eventDate
                ? [{ label: "תאריך האירוע", value: formatDate(doc.eventDate) }]
                : []),
              ...(doc.eventLocation
                ? [{ label: "מיקום האירוע", value: doc.eventLocation }]
                : []),
              ...(doc.eventHours != null
                ? [{ label: "שעות צילום", value: doc.eventHours.toString() }]
                : []),
              ...(doc.eventTime
                ? [{ label: "שעת האירוע", value: doc.eventTime }]
                : []),
              ...(!isDraft
                ? [
                    { label: "אימייל לקוח", value: doc.customerEmail ?? "—" },
                    { label: "כתובת לקוח", value: doc.customerAddress ?? "—" },
                    { label: 'ח.פ. / ע"מ לקוח', value: doc.customerTaxId ?? "—" },
                    { label: "שם העסק", value: doc.businessName ?? "—" },
                    { label: "כתובת העסק", value: doc.businessAddress ?? "—" },
                    { label: 'ח.פ. / ע"מ עסק', value: doc.businessTaxId ?? "—" },
                  ]
                : []),
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="font-medium text-slate-500">{label}</dt>
                <dd className="mt-0.5 text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>

          {doc.notes && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-1 text-xs font-medium text-slate-500">הערות ללקוח</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{doc.notes}</p>
            </div>
          )}
          {doc.internalNotes && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-slate-500">הערות פנימיות</p>
              <p className="whitespace-pre-wrap text-sm text-slate-500">
                {doc.internalNotes}
              </p>
            </div>
          )}

          {(doc.sourceDocument || doc.creditNote) && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
              {doc.sourceDocument && (
                <p className="text-slate-600">
                  מסמך מקור:{" "}
                  <Link
                    href={`/documents/${doc.sourceDocument.id}`}
                    className="text-brand-600 hover:text-brand-800"
                  >
                    {doc.sourceDocument.number ?? "ללא מספר"}
                  </Link>
                </p>
              )}
              {doc.creditNote && (
                <p className="text-slate-600">
                  זיכוי קשור:{" "}
                  <Link
                    href={`/documents/${doc.creditNote.id}`}
                    className="text-brand-600 hover:text-brand-800"
                  >
                    {doc.creditNote.number ?? "טיוטת זיכוי"}
                  </Link>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>פריטים</CardTitle>
        </CardHeader>

        <div className="divide-y divide-slate-100 border-t border-slate-100 sm:hidden">
          {doc.items.map((item) => (
            <div key={item.id} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">#{item.lineIndex + 1}</p>
                  <p className="break-words text-sm font-medium text-slate-800">
                    {item.description}
                  </p>
                </div>
                <p className="shrink-0 text-base font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(item.totalAmount.toString())}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                <div className="flex justify-between">
                  <dt className="text-slate-500">כמות</dt>
                  <dd className="tabular-nums">{item.quantity.toString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">מחיר יח'</dt>
                  <dd className="tabular-nums">{formatCurrency(item.unitPrice.toString())}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">לפני מע"מ</dt>
                  <dd className="tabular-nums">{formatCurrency(item.subtotalAmount.toString())}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">מע"מ</dt>
                  <dd className="tabular-nums">{formatCurrency(item.taxAmount.toString())}</dd>
                </div>
                {Number(item.discountAmount) > 0 && (
                  <div className="col-span-2 flex justify-between">
                    <dt className="text-slate-500">הנחה</dt>
                    <dd className="tabular-nums">{formatCurrency(item.discountAmount.toString())}</dd>
                  </div>
                )}
              </dl>
            </div>
          ))}
        </div>

        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>תיאור</TableHead>
                <TableHead className="text-left">כמות</TableHead>
                <TableHead className="text-left">מחיר יחידה</TableHead>
                <TableHead className="text-left">הנחה</TableHead>
                <TableHead className="text-left">לפני מע"מ</TableHead>
                <TableHead className="text-left">מע"מ</TableHead>
                <TableHead className="text-left">סה"כ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doc.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs text-slate-400">
                    {item.lineIndex + 1}
                  </TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-left tabular-nums">
                    {item.quantity.toString()}
                  </TableCell>
                  <TableCell className="text-left tabular-nums">
                    {formatCurrency(item.unitPrice.toString())}
                  </TableCell>
                  <TableCell className="text-left tabular-nums text-slate-500">
                    {Number(item.discountAmount) > 0
                      ? formatCurrency(item.discountAmount.toString())
                      : "—"}
                  </TableCell>
                  <TableCell className="text-left tabular-nums">
                    {formatCurrency(item.subtotalAmount.toString())}
                  </TableCell>
                  <TableCell className="text-left tabular-nums text-slate-500">
                    {formatCurrency(item.taxAmount.toString())}
                  </TableCell>
                  <TableCell className="text-left font-medium tabular-nums">
                    {formatCurrency(item.totalAmount.toString())}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <dl className="mr-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">סכום לפני מע"מ</dt>
              <dd className="font-medium tabular-nums">
                {formatCurrency(doc.subtotalAmount.toString())}
              </dd>
            </div>
            {Number(doc.vatRateSnapshot) > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500">מע"מ ({doc.vatRateSnapshot.toString()}%)</dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(doc.taxAmount.toString())}
                </dd>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1">
              <dt className="font-semibold text-slate-800">סה"כ לתשלום</dt>
              <dd className="text-lg font-bold text-slate-900 tabular-nums">
                {formatCurrency(doc.totalAmount.toString())}
              </dd>
            </div>
            {!isDraft && (
              <>
                <div className="flex justify-between text-slate-500">
                  <dt>שולם</dt>
                  <dd className="tabular-nums">
                    {formatCurrency(doc.amountPaid.toString())}
                  </dd>
                </div>
                <div className="mt-1 flex justify-between border-t border-slate-200 pt-1">
                  <dt className="font-semibold text-slate-800">יתרה לתשלום</dt>
                  <dd className="font-bold text-brand-700 tabular-nums">
                    {formatCurrency(doc.amountDue.toString())}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {!isDraft && (
        <Card>
          <CardHeader>
            <CardTitle>תשלומים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {doc.payments.length === 0 ? (
              <p className="text-sm text-slate-500">אין תשלומים רשומים</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>תאריך</TableHead>
                    <TableHead className="text-left">סכום</TableHead>
                    <TableHead>אמצעי תשלום</TableHead>
                    <TableHead>אסמכתא</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doc.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-xs text-slate-500">
                        {formatDate(payment.paymentDate)}
                      </TableCell>
                      <TableCell className="text-left font-medium tabular-nums">
                        {formatCurrency(payment.amount.toString())}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ??
                          payment.method}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {payment.reference ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <DeletePaymentButton paymentId={payment.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {canAddPayment && (
              <div className="border-t border-slate-100 pt-2">
                <p className="mb-3 text-sm font-medium text-slate-700">הוסף תשלום</p>
                <AddPaymentForm
                  documentId={doc.id}
                  amountDue={doc.amountDue.toString()}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Link
        href="/documents"
        className="inline-flex min-h-[44px] items-center text-sm text-brand-600 hover:text-brand-800"
      >
        חזרה לרשימת מסמכים
      </Link>
    </div>
  );
}
