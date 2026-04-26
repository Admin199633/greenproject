import { notFound } from "next/navigation";
import Link from "next/link";
import { requireBusiness } from "@/services/auth.service";
import { getCustomerDetail, getDisplayName } from "@/services/customer.service";
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
import DeactivateButton from "@/components/customers/DeactivateButton";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/validations/payment";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const business = await requireBusiness();
  const { customer, recentDocuments, recentPayments, openAmount } =
    await getCustomerDetail(id, business.id);

  if (!customer) notFound();

  const contactDetails = [
    { label: "אימייל", value: customer.email },
    { label: "טלפון", value: customer.phone },
    { label: "כתובת", value: customer.address },
    { label: "מספר עוסק / ח.פ.", value: customer.taxId },
    { label: "הערות", value: customer.notes },
  ].filter((r): r is { label: string; value: string } => !!r.value);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {getDisplayName(customer)}
          </h2>
          {customer.companyName && customer.fullName && (
            <p className="text-slate-500 mt-0.5 text-sm">{customer.fullName}</p>
          )}
          {!customer.isActive && (
            <span className="inline-block mt-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5">
              לקוח מבוטל
            </span>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <Link
            href={`/customers/${customer.id}/edit`}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            עריכה
          </Link>
          {customer.isActive && <DeactivateButton customerId={customer.id} />}
        </div>
      </div>

      {/* KPI — open amount */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-slate-500 mb-1">סכום פתוח לתשלום</p>
          <p className="text-2xl font-bold text-brand-700 tabular-nums">
            {formatCurrency(openAmount.toString())}
          </p>
        </CardContent>
      </Card>

      {/* Contact details */}
      <Card>
        <CardHeader>
          <CardTitle>פרטי קשר</CardTitle>
        </CardHeader>
        <CardContent>
          {contactDetails.length === 0 ? (
            <p className="text-sm text-slate-500">לא הוזנו פרטים נוספים</p>
          ) : (
            <dl className="divide-y divide-slate-100">
              {contactDetails.map(({ label, value }) => (
                <div key={label} className="flex py-3 gap-4">
                  <dt className="w-44 shrink-0 text-sm font-medium text-slate-500">
                    {label}
                  </dt>
                  <dd className="text-sm text-slate-800 whitespace-pre-wrap">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      {/* Recent documents */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>מסמכים אחרונים</CardTitle>
        </CardHeader>
        {recentDocuments.length === 0 ? (
          <CardContent>
            <p className="text-sm text-slate-500">אין מסמכים</p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מספר</TableHead>
                <TableHead>סוג</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>תאריך הנפקה</TableHead>
                <TableHead className="text-left">סה״כ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <Link
                      href={`/documents/${doc.id}`}
                      className="text-brand-600 hover:text-brand-800 font-medium"
                    >
                      {doc.number ?? "טיוטה"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <DocumentTypeBadge type={doc.type} />
                  </TableCell>
                  <TableCell>
                    <DocumentStatusBadge status={doc.status} />
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {doc.issueDate ? formatDate(doc.issueDate) : "—"}
                  </TableCell>
                  <TableCell className="text-left tabular-nums font-medium">
                    {formatCurrency(doc.totalAmount.toString())}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Recent payments */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>תשלומים אחרונים</CardTitle>
        </CardHeader>
        {recentPayments.length === 0 ? (
          <CardContent>
            <p className="text-sm text-slate-500">אין תשלומים</p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead className="text-left">סכום</TableHead>
                <TableHead>אמצעי תשלום</TableHead>
                <TableHead>אסמכתא</TableHead>
                <TableHead>מסמך</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-slate-500 text-sm">
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
                  <TableCell>
                    <Link
                      href={`/documents/${payment.documentId}`}
                      className="text-brand-600 hover:text-brand-800 text-sm"
                    >
                      צפה במסמך
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Link
        href="/customers"
        className="text-sm text-brand-600 hover:text-brand-800 inline-block"
      >
        → חזרה לרשימת לקוחות
      </Link>
    </div>
  );
}
