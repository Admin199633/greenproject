import Link from "next/link";
import { requireBusiness } from "@/services/auth.service";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/validations/payment";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type Tab = "revenue" | "open" | "payments";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    dateFrom?: string;
    dateTo?: string;
    method?: string;
    customerId?: string;
  }>;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "revenue", label: "הכנסות לפי חודש" },
  { key: "open", label: "מסמכים פתוחים" },
  { key: "payments", label: "תשלומים" },
];

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchRevenue(
  businessId: string,
  dateFrom?: string,
  dateTo?: string
) {
  const documents = await db.document.findMany({
    where: {
      businessId,
      type: { in: ["INVOICE", "INVOICE_RECEIPT"] },
      status: { notIn: ["DRAFT", "CANCELLED"] },
      ...(dateFrom || dateTo
        ? {
            issueDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    select: {
      issueDate: true,
      subtotalAmount: true,
      taxAmount: true,
      totalAmount: true,
    },
    orderBy: { issueDate: "asc" },
  });

  const byMonth = new Map<
    string,
    {
      count: number;
      subtotal: Prisma.Decimal;
      tax: Prisma.Decimal;
      total: Prisma.Decimal;
    }
  >();

  for (const doc of documents) {
    const date = doc.issueDate ?? new Date(0);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const existing = byMonth.get(month);
    if (existing) {
      existing.count += 1;
      existing.subtotal = existing.subtotal.plus(doc.subtotalAmount);
      existing.tax = existing.tax.plus(doc.taxAmount);
      existing.total = existing.total.plus(doc.totalAmount);
    } else {
      byMonth.set(month, {
        count: 1,
        subtotal: new Prisma.Decimal(doc.subtotalAmount),
        tax: new Prisma.Decimal(doc.taxAmount),
        total: new Prisma.Decimal(doc.totalAmount),
      });
    }
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      count: d.count,
      subtotalAmount: d.subtotal,
      taxAmount: d.tax,
      totalAmount: d.total,
    }));
}

async function fetchOpenDocuments(businessId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return db.document.findMany({
    where: {
      businessId,
      status: { in: ["ISSUED", "PARTIALLY_PAID"] },
    },
    select: {
      id: true,
      number: true,
      issueDate: true,
      dueDate: true,
      totalAmount: true,
      amountPaid: true,
      amountDue: true,
      customer: { select: { id: true, fullName: true, companyName: true } },
    },
    orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
  });
}

async function fetchPayments(
  businessId: string,
  filters: { dateFrom?: string; dateTo?: string; method?: string; customerId?: string }
) {
  return db.payment.findMany({
    where: {
      businessId,
      ...(filters.dateFrom || filters.dateTo
        ? {
            paymentDate: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
            },
          }
        : {}),
      ...(filters.method ? { method: filters.method } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
    },
    select: {
      id: true,
      paymentDate: true,
      method: true,
      reference: true,
      amount: true,
      customer: { select: { id: true, fullName: true, companyName: true } },
      document: { select: { id: true, number: true, type: true } },
    },
    orderBy: { paymentDate: "desc" },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function customerName(c: { fullName: string | null; companyName: string | null }) {
  if (c.companyName && c.fullName) return `${c.companyName} — ${c.fullName}`;
  return c.companyName || c.fullName || "—";
}

function formatMonth(month: string) {
  const [year, m] = month.split("-");
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(
    new Date(Number(year), Number(m) - 1, 1)
  );
}

// ─── Tab content components ───────────────────────────────────────────────────

function RevenueTab({
  rows,
  dateFrom,
  dateTo,
}: {
  rows: Awaited<ReturnType<typeof fetchRevenue>>;
  dateFrom?: string;
  dateTo?: string;
}) {
  const totals = rows.reduce(
    (acc, r) => ({
      count: acc.count + r.count,
      subtotal: acc.subtotal.plus(r.subtotalAmount),
      tax: acc.tax.plus(r.taxAmount),
      total: acc.total.plus(r.totalAmount),
    }),
    {
      count: 0,
      subtotal: new Prisma.Decimal(0),
      tax: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0),
    }
  );

  return (
    <div className="space-y-4">
      {/* Date filters */}
      <form method="GET" className="flex items-end gap-3 flex-wrap">
        <input type="hidden" name="tab" value="revenue" />
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="dateFrom">מתאריך</label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={dateFrom ?? ""}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="dateTo">עד תאריך</label>
          <input
            id="dateTo"
            name="dateTo"
            type="date"
            defaultValue={dateTo ?? ""}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <button
          type="submit"
          className="h-9 px-4 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          סנן
        </button>
        {(dateFrom || dateTo) && (
          <Link
            href="/reports?tab=revenue"
            className="h-9 px-3 flex items-center rounded-md border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
          >
            נקה
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">אין נתוני הכנסות לתקופה הנבחרת</p>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>חודש</TableHead>
                <TableHead className="text-center">מסמכים</TableHead>
                <TableHead className="text-left">לפני מע״מ</TableHead>
                <TableHead className="text-left">מע״מ</TableHead>
                <TableHead className="text-left font-bold">סה״כ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="font-medium">{formatMonth(row.month)}</TableCell>
                  <TableCell className="text-center tabular-nums">{row.count}</TableCell>
                  <TableCell className="text-left tabular-nums">
                    {formatCurrency(row.subtotalAmount.toString())}
                  </TableCell>
                  <TableCell className="text-left tabular-nums">
                    {formatCurrency(row.taxAmount.toString())}
                  </TableCell>
                  <TableCell className="text-left tabular-nums font-semibold text-slate-800">
                    {formatCurrency(row.totalAmount.toString())}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-slate-50 font-semibold">
                <TableCell>סה״כ</TableCell>
                <TableCell className="text-center tabular-nums">{totals.count}</TableCell>
                <TableCell className="text-left tabular-nums">
                  {formatCurrency(totals.subtotal.toString())}
                </TableCell>
                <TableCell className="text-left tabular-nums">
                  {formatCurrency(totals.tax.toString())}
                </TableCell>
                <TableCell className="text-left tabular-nums text-brand-700">
                  {formatCurrency(totals.total.toString())}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function OpenDocumentsTab({
  rows,
}: {
  rows: Awaited<ReturnType<typeof fetchOpenDocuments>>;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">אין מסמכים פתוחים</p>;
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>מספר</TableHead>
            <TableHead>לקוח</TableHead>
            <TableHead>תאריך הנפקה</TableHead>
            <TableHead>תאריך תשלום</TableHead>
            <TableHead className="text-left">סה״כ</TableHead>
            <TableHead className="text-left">שולם</TableHead>
            <TableHead className="text-left">יתרה</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((doc) => {
            const isOverdue =
              doc.dueDate != null && new Date(doc.dueDate) < today;
            return (
              <TableRow
                key={doc.id}
                className={isOverdue ? "bg-red-50" : undefined}
              >
                <TableCell>
                  <Link
                    href={`/documents/${doc.id}`}
                    className="text-brand-600 hover:text-brand-800 font-medium"
                  >
                    {doc.number ?? "—"}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  {customerName(doc.customer)}
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {doc.issueDate ? formatDate(doc.issueDate) : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-sm",
                    isOverdue ? "text-red-600 font-medium" : "text-slate-500"
                  )}
                >
                  {doc.dueDate ? formatDate(doc.dueDate) : "—"}
                </TableCell>
                <TableCell className="text-left tabular-nums">
                  {formatCurrency(doc.totalAmount.toString())}
                </TableCell>
                <TableCell className="text-left tabular-nums text-slate-500">
                  {formatCurrency(doc.amountPaid.toString())}
                </TableCell>
                <TableCell className="text-left tabular-nums font-semibold text-slate-800">
                  {formatCurrency(doc.amountDue.toString())}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function PaymentsTab({
  rows,
  filters,
}: {
  rows: Awaited<ReturnType<typeof fetchPayments>>;
  filters: { dateFrom?: string; dateTo?: string; method?: string };
}) {
  return (
    <div className="space-y-4">
      <form method="GET" className="flex items-end gap-3 flex-wrap">
        <input type="hidden" name="tab" value="payments" />
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="p-dateFrom">מתאריך</label>
          <input
            id="p-dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={filters.dateFrom ?? ""}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="p-dateTo">עד תאריך</label>
          <input
            id="p-dateTo"
            name="dateTo"
            type="date"
            defaultValue={filters.dateTo ?? ""}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="p-method">אמצעי תשלום</label>
          <select
            id="p-method"
            name="method"
            defaultValue={filters.method ?? ""}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">הכל</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-9 px-4 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          סנן
        </button>
        {(filters.dateFrom || filters.dateTo || filters.method) && (
          <Link
            href="/reports?tab=payments"
            className="h-9 px-3 flex items-center rounded-md border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
          >
            נקה
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">אין תשלומים לתקופה הנבחרת</p>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>תאריך</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>מסמך</TableHead>
                <TableHead>אמצעי</TableHead>
                <TableHead>אסמכתא</TableHead>
                <TableHead className="text-left">סכום</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm text-slate-500">
                    {formatDate(p.paymentDate)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {customerName(p.customer)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/documents/${p.document.id}`}
                      className="text-brand-600 hover:text-brand-800 text-sm"
                    >
                      {p.document.number ?? p.document.id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}
                  </TableCell>
                  <TableCell className="text-sm text-slate-400">
                    {p.reference ?? "—"}
                  </TableCell>
                  <TableCell className="text-left tabular-nums font-medium">
                    {formatCurrency(p.amount.toString())}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const activeTab: Tab =
    params.tab === "open" || params.tab === "payments" ? params.tab : "revenue";

  const business = await requireBusiness();

  const [revenueRows, openRows, paymentsRows] = await Promise.all([
    activeTab === "revenue"
      ? fetchRevenue(business.id, params.dateFrom, params.dateTo)
      : Promise.resolve([]),
    activeTab === "open" ? fetchOpenDocuments(business.id) : Promise.resolve([]),
    activeTab === "payments"
      ? fetchPayments(business.id, {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          method: params.method,
          customerId: params.customerId,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">דוחות</h2>
        <p className="text-sm text-slate-500 mt-0.5">סקירה פיננסית של העסק</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/reports?tab=${tab.key}`}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "revenue" && (
        <RevenueTab
          rows={revenueRows}
          dateFrom={params.dateFrom}
          dateTo={params.dateTo}
        />
      )}
      {activeTab === "open" && <OpenDocumentsTab rows={openRows} />}
      {activeTab === "payments" && (
        <PaymentsTab
          rows={paymentsRows}
          filters={{
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            method: params.method,
          }}
        />
      )}
    </div>
  );
}
