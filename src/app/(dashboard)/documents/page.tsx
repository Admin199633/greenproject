import { Suspense } from "react";
import Link from "next/link";
import { requireBusiness } from "@/services/auth.service";
import { listDocuments } from "@/services/document.service";
import { listCustomers } from "@/services/customer.service";
import { getDisplayName } from "@/services/customer.service";
import { Card } from "@/components/ui/Card";
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
import DocumentFilters from "@/components/documents/DocumentFilters";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    customerId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function DocumentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const business = await requireBusiness();

  const [documents, customers] = await Promise.all([
    listDocuments(business.id, params),
    listCustomers(business.id),
  ]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">מסמכים</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {documents.length} מסמכים
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/api/documents/export?${new URLSearchParams(
              Object.fromEntries(
                Object.entries(params).filter(([, v]) => v != null) as [string, string][]
              )
            ).toString()}`}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 sm:h-9 px-4 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex-1 sm:flex-initial"
          >
            ייצוא CSV
          </Link>
          <Link
            href="/documents/new"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 sm:h-9 px-4 bg-brand-600 text-white hover:bg-brand-700 transition-colors flex-1 sm:flex-initial"
          >
            + מסמך חדש
          </Link>
        </div>
      </div>

      {/* Filters — Suspense required for useSearchParams */}
      <Suspense fallback={<div className="h-9" />}>
        <DocumentFilters customers={customers} />
      </Suspense>

      {/* List */}
      {documents.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          לא נמצאו מסמכים
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <ul className="sm:hidden space-y-2">
            {documents.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/documents/${doc.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-4 active:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <DocumentTypeBadge type={doc.type} />
                        <DocumentStatusBadge status={doc.status} />
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-800 truncate">
                        {getDisplayName(doc.customer)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {doc.number ?? "טיוטה"} ·{" "}
                        {doc.issueDate ? formatDate(doc.issueDate) : "ללא תאריך"}
                      </p>
                    </div>
                    <p className="shrink-0 text-base font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(doc.totalAmount.toString())}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <Card className="hidden sm:block overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מספר</TableHead>
                  <TableHead>סוג</TableHead>
                  <TableHead>לקוח</TableHead>
                  <TableHead>תאריך</TableHead>
                  <TableHead className="text-left">סה״כ</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="text-slate-400 text-xs">
                      {doc.number ?? "—"}
                    </TableCell>
                    <TableCell>
                      <DocumentTypeBadge type={doc.type} />
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {getDisplayName(doc.customer)}
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs">
                      {doc.issueDate ? formatDate(doc.issueDate) : "—"}
                    </TableCell>
                    <TableCell className="text-left tabular-nums font-medium">
                      {formatCurrency(doc.totalAmount.toString())}
                    </TableCell>
                    <TableCell>
                      <DocumentStatusBadge status={doc.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Link
                        href={`/documents/${doc.id}`}
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
        </>
      )}
    </div>
  );
}
