import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { requireBusinessId } from "@/services/auth.service";
import { getDisplayName } from "@/services/customer.service";
import { getDashboardData } from "@/services/dashboard.service";
import { perf } from "@/lib/perf";
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
  DocumentStatusBadge,
  DocumentTypeBadge,
} from "@/components/documents/DocumentStatusBadge";

export default async function DashboardPage() {
  const t0 = Date.now();
  const { user, businessId } = await requireBusinessId();
  const dashboard = await perf("dashboard load total", () =>
    getDashboardData(businessId)
  );
  console.log(`[perf] dashboard page total ${Date.now() - t0}ms`);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">לוח בקרה</h2>
        <p className="mt-1 text-slate-500">
          ברוך הבא, {user.name ?? user.email}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="לקוחות פעילים"
          value={dashboard.kpis.activeCustomersCount.toString()}
        />
        <StatCard
          title="מסמכים שהונפקו"
          value={dashboard.kpis.issuedDocumentsCount.toString()}
        />
        <StatCard
          title="סכום ששולם"
          value={formatCurrency(dashboard.kpis.totalPaidAmount.toString())}
        />
        <StatCard
          title="יתרה פתוחה"
          value={formatCurrency(dashboard.kpis.totalOpenAmount.toString())}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>מסמכים אחרונים</CardTitle>
            <Link
              href="/documents"
              className="text-sm text-brand-600 hover:text-brand-800"
            >
              לכל המסמכים
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {dashboard.recentDocuments.length === 0 ? (
              <EmptyState text="עדיין אין מסמכים להצגה" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>מספר</TableHead>
                    <TableHead>לקוח</TableHead>
                    <TableHead>סוג</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead className="text-left">סה״כ</TableHead>
                    <TableHead>תאריך</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.recentDocuments.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell className="text-xs text-slate-500">
                        {document.number ?? "טיוטה"}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {getDisplayName(document.customer)}
                      </TableCell>
                      <TableCell>
                        <DocumentTypeBadge type={document.type} />
                      </TableCell>
                      <TableCell>
                        <DocumentStatusBadge status={document.status} />
                      </TableCell>
                      <TableCell className="text-left font-medium tabular-nums">
                        {formatCurrency(document.totalAmount.toString())}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {formatDate(document.issueDate ?? document.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>תשלומים אחרונים</CardTitle>
            <Link
              href="/payments"
              className="text-sm text-brand-600 hover:text-brand-800"
            >
              לכל התשלומים
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {dashboard.recentPayments.length === 0 ? (
              <EmptyState text="עדיין אין תשלומים להצגה" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>סכום</TableHead>
                    <TableHead>תאריך</TableHead>
                    <TableHead>לקוח</TableHead>
                    <TableHead>מסמך</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.recentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium tabular-nums text-slate-800">
                        {formatCurrency(payment.amount.toString())}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {formatDate(payment.paymentDate)}
                      </TableCell>
                      <TableCell>{getDisplayName(payment.customer)}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {payment.document.number ?? payment.document.id}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>מסמכים בפיגור</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              מסמכים שהונפקו, מועד התשלום שלהם עבר, ועדיין נותרה יתרה פתוחה
            </p>
          </div>
          <Link
            href="/documents"
            className="text-sm text-brand-600 hover:text-brand-800"
          >
            בדיקת מסמכים
          </Link>
        </CardHeader>
        <CardContent>
          {dashboard.overdueDocuments.length === 0 ? (
            <EmptyState text="אין כרגע מסמכים בפיגור" />
          ) : (
            <div className="space-y-3">
              {dashboard.overdueDocuments.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-slate-800">
                      {document.number ?? "ללא מספר"} · {getDisplayName(document.customer)}
                    </p>
                    <p className="text-sm text-slate-500">
                      לתשלום עד {document.dueDate ? formatDate(document.dueDate) : "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="text-xs text-slate-500">יתרה</p>
                    <p className="font-semibold tabular-nums text-red-600">
                      {formatCurrency(document.amountDue.toString())}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-slate-500">{text}</p>;
}
