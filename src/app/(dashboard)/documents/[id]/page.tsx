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
  const canDownloadPdf = !isDraft && doc.status !== "CANCELLED";
  const canAddPayment =
    !isDraft &&
    doc.type !== "QUOTE" &&
    doc.type !== "CREDIT_NOTE" &&
    doc.status !== "CANCELLED" &&
    doc.status !== "PAID" &&
    doc.amountDue.gt(0);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
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

        <div className="flex items-start gap-2 flex-wrap shrink-0">
          {isDraft ? (
            <>
              <IssueDraftButton documentId={doc.id} />
              <Link
                href={`/documents/${doc.id}/edit`}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              >
                עריכה
              </Link>
              <DuplicateDocumentButton documentId={doc.id} />
              <DeleteDraftButton documentId={doc.id} />
            </>
          ) : (
            <>
              {canDownloadPdf && (
                <DocumentShareActions
                  documentId={doc.id}
                  customerName={doc.customerName ?? getDisplayName(doc.customer)}
                  customerPhone={doc.customer.phone}
                  documentType={doc.type}
                  documentNumber={doc.number ?? doc.id}
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
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
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
                <dt className="text-slate-500 font-medium">{label}</dt>
                <dd className="text-slate-800 mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>

          {doc.notes && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 font-medium mb-1">הערות ללקוח</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{doc.notes}</p>
            </div>
          )}
          {doc.internalNotes && (
            <div className="mt-3">
              <p className="text-xs text-slate-500 font-medium mb-1">הערות פנימיות</p>
              <p className="text-sm text-slate-500 whitespace-pre-wrap">
                {doc.internalNotes}
              </p>
            </div>
          )}

          {(doc.sourceDocument || doc.creditNote) && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm">
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

        <div className="sm:hidden divide-y divide-slate-100 border-t border-slate-100">
          {doc.items.map((item) => (
            <div key={item.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">#{item.lineIndex + 1}</p>
                  <p className="text-sm font-medium text-slate-800 break-words">
                    {item.description}
                  </p>
                </div>
                <p className="text-base font-semibold text-slate-900 tabular-nums shrink-0">
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
                  <div className="flex justify-between col-span-2">
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
                  <TableCell className="text-slate-400 text-xs">
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
                  <TableCell className="text-left tabular-nums font-medium">
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
          <dl className="space-y-1 text-sm max-w-xs mr-auto">
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
            <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
              <dt className="font-semibold text-slate-800">סה"כ לתשלום</dt>
              <dd className="font-bold text-lg tabular-nums text-slate-900">
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
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                  <dt className="font-semibold text-slate-800">יתרה לתשלום</dt>
                  <dd className="font-bold tabular-nums text-brand-700">
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
                      <TableCell className="text-slate-500 text-xs">
                        {formatDate(payment.paymentDate)}
                      </TableCell>
                      <TableCell className="text-left tabular-nums font-medium">
                        {formatCurrency(payment.amount.toString())}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ??
                          payment.method}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">
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
              <div className="pt-2 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-700 mb-3">הוסף תשלום</p>
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
        className="text-sm text-brand-600 hover:text-brand-800 inline-block"
      >
        חזרה לרשימת מסמכים
      </Link>
    </div>
  );
}
