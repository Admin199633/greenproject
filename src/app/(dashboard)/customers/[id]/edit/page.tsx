import { notFound } from "next/navigation";
import { requireBusiness } from "@/services/auth.service";
import { getCustomerById, getDisplayName } from "@/services/customer.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import CustomerForm from "@/components/customers/CustomerForm";
import { updateCustomerAction } from "@/app/(dashboard)/customers/actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({ params }: PageProps) {
  const { id } = await params;
  const business = await requireBusiness();
  const customer = await getCustomerById(id, business.id);

  if (!customer) notFound();

  // Bind the customer id as the first argument to the server action
  const action = updateCustomerAction.bind(null, customer.id);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">עריכת לקוח</h2>
        <p className="text-sm text-slate-500 mt-0.5">{getDisplayName(customer)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>פרטי לקוח</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerForm
            action={action}
            defaultValues={customer}
            cancelHref={`/customers/${customer.id}`}
            submitLabel="שמור שינויים"
          />
        </CardContent>
      </Card>
    </div>
  );
}
