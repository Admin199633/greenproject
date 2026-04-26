import Link from "next/link";
import { requireBusiness } from "@/services/auth.service";
import { listPayments } from "@/services/payment.service";
import { listCustomers, getDisplayName } from "@/services/customer.service";
import { Card } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { DocumentTypeBadge } from "@/components/documents/DocumentStatusBadge";
import DeletePaymentButton from "@/components/payments/DeletePaymentButton";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/validations/payment";

interface PageProps {
  searchParams: Promise<{
    method?: string;
    dateFrom?: string;
    dateTo?: string;
    customerId?: string;
  }>;
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const business = await requireBusiness();

  const [payments, customers] = await Promise.all([
    listPayments(business.id, {
      method: params.method,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      customerId: params.customerId,
    }),
    listCustomers(business.id),
  ]);

  const hasFilters = !!(params.method || params.dateFrom || params.dateTo || params.customerId);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">תשלומים</h2>
        <p className="text-sm text-slate-500 mt-0.5">{payments.length} תשלומים</p>
      </div>

      {/* Filters */}
      <form method="GET" className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="dateFrom">מתאריך</label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={params.dateFrom ?? ""}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="dateTo">עד תאריך</label>
          <input
            id="dateTo"
            name="dateTo"
            type="date"
            defaultValue={params.dateTo ?? ""}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="method">אמצעי תשלום</label>
          <select
            id="method"
            name="method"
            defaultValue={params.method ?? ""}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">הכל</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="customerId">לקוח</label>
          <select
            id="customerId"
            name="customerId"
            defaultValue={params.customerId ?? ""}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">כל הלקוחות</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{getDisplayName(c)}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-9 px-4 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          סנן
        </button>
        {hasFilters && (
          <Link
            href="/payments"
            className="h-9 px-3 flex items-center rounded-md border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
          >
            נקה
          </Link>
        )}
      </form>

      {payments.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          {hasFilters ? "לא נמצאו תשלומים לפילטר הנבחר" : "לא נמצאו תשלומים"}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>מסמך</TableHead>
                <TableHead className="text-left">סכום</TableHead>
                <TableHead>אמצעי תשלום</TableHead>
                <TableHead>אסמכתא</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-slate-500 text-xs">
                    {formatDate(payment.paymentDate)}
                  </TableCell>
                  <TableCell className="font-medium text-slate-800">
                    {getDisplayName(payment.customer)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/documents/${payment.document.id}`}
                      className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-800"
                    >
                      <DocumentTypeBadge type={payment.document.type} />
                      <span className="text-xs font-mono">
                        {payment.document.number ?? "טיוטה"}
                      </span>
                    </Link>
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
        </Card>
      )}
    </div>
  );
}
