import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import CustomerForm from "@/components/customers/CustomerForm";
import { createCustomerAction } from "@/app/(dashboard)/customers/actions";

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">לקוח חדש</h2>
        <p className="text-sm text-slate-500 mt-0.5">הוספת לקוח למאגר</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>פרטי לקוח</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerForm
            action={createCustomerAction}
            cancelHref="/customers"
            submitLabel="הוסף לקוח"
          />
        </CardContent>
      </Card>
    </div>
  );
}
