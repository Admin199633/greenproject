import { Suspense } from "react";
import Link from "next/link";
import { requireBusiness } from "@/services/auth.service";
import { listCustomers, getDisplayName } from "@/services/customer.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Card } from "@/components/ui/Card";
import CustomerSearch from "@/components/customers/CustomerSearch";
import { Input } from "@/components/ui/Input";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const business = await requireBusiness();
  const customers = await listCustomers(business.id, q);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">לקוחות</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {customers.length} לקוחות פעילים
            {q && ` עבור "${q}"`}
          </p>
        </div>
        <Link
          href="/customers/new"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-brand-600 text-white hover:bg-brand-700 transition-colors shrink-0"
        >
          + לקוח חדש
        </Link>
      </div>

      {/* Search — wrapped in Suspense because useSearchParams requires it */}
      <Suspense
        fallback={
          <Input
            type="search"
            placeholder="חיפוש לפי שם, חברה, אימייל או טלפון..."
            className="max-w-sm"
            disabled
          />
        }
      >
        <CustomerSearch />
      </Suspense>

      {/* Table */}
      {customers.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          {q ? `לא נמצאו לקוחות עבור "${q}"` : "אין לקוחות עדיין — הוסף לקוח ראשון"}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>אימייל</TableHead>
                <TableHead>טלפון</TableHead>
                <TableHead>ח.פ. / ע.מ.</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="font-medium text-slate-800">
                      {getDisplayName(customer)}
                    </div>
                    {customer.companyName && customer.fullName && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {customer.fullName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{customer.email ?? "—"}</TableCell>
                  <TableCell>{customer.phone ?? "—"}</TableCell>
                  <TableCell>{customer.taxId ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="text-brand-600 hover:text-brand-800 font-medium text-sm"
                    >
                      פרטים
                    </Link>
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
