import { requireBusinessId } from "@/services/auth.service";
import { getBusiness } from "@/services/business.service";
import { listSavedItems } from "@/services/savedItem.service";
import {
  getConnectionStatus,
  getGoogleOauthEnv,
} from "@/services/google-calendar.service";
import { perf } from "@/lib/perf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import BusinessSettingsForm from "./BusinessSettingsForm";
import SavedItemsManager from "./SavedItemsManager";
import GoogleCalendarSection from "./GoogleCalendarSection";

export default async function SettingsPage() {
  const t0 = Date.now();
  const { businessId } = await requireBusinessId();

  const [business, savedItems, calendarStatus] = await perf(
    "settings load total",
    () =>
      Promise.all([
        getBusiness(businessId),
        listSavedItems(businessId),
        getConnectionStatus(businessId),
      ])
  );

  if (!business) {
    return <p className="text-red-600">לא נמצא עסק</p>;
  }

  console.log(`[perf] settings page total ${Date.now() - t0}ms`);
  console.debug("[approval-template] settings reload business", {
    approvalWhatsappMessageTemplate:
      business.approvalWhatsappMessageTemplate ?? null,
    hasReplacement:
      business.approvalWhatsappMessageTemplate?.includes("\uFFFD") ?? false,
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">הגדרות עסק</h1>
        <p className="text-sm text-slate-500 mt-1">עדכון פרטי העסק שיופיעו במסמכים</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>פרטי העסק</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessSettingsForm
            defaultValues={{
              name: business.name,
              taxId: business.taxId,
              address: business.address,
              city: business.city,
              postalCode: business.postalCode,
              country: business.country ?? "IL",
              phone: business.phone,
              email: business.email,
              taxType: (business.taxType as "osek_murshe" | "osek_patur" | "chevra") ?? "osek_murshe",
              businessType: (business.businessType as "general" | "photography" | "contractor" | "consulting" | "retail" | "other") ?? "general",
              vatRate: Number(business.vatRate) ?? 17,
              currency: business.currency ?? "ILS",
              invoiceNumberPrefix: business.invoiceNumberPrefix ?? "INV-",
              invoiceStartNumber: business.invoiceStartNumber ?? 1,
              receiptNumberPrefix: business.receiptNumberPrefix ?? "REC-",
              receiptStartNumber: business.receiptStartNumber ?? 1,
              quoteNumberPrefix: business.quoteNumberPrefix ?? "QUO-",
              quoteStartNumber: business.quoteStartNumber ?? 1,
              invoiceReceiptNumberPrefix: business.invoiceReceiptNumberPrefix ?? "INVR-",
              invoiceReceiptStartNumber:
                business.invoiceReceiptStartNumber ?? 1,
              sendIssueNotificationEmail: business.sendIssueNotificationEmail ?? false,
              quoteTermsText: business.quoteTermsText,
              approvalWhatsappMessageTemplate:
                business.approvalWhatsappMessageTemplate,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>חיבור ליומן Google</CardTitle>
        </CardHeader>
        <CardContent>
          <GoogleCalendarSection
            initial={{
              connected: calendarStatus.connected,
              googleEmail: calendarStatus.googleEmail,
              configured: Boolean(getGoogleOauthEnv()),
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>פריטים שמורים</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-4">
            פריטים שמורים מאפשרים מילוי מהיר של שורות במסמכים.
          </p>
          <SavedItemsManager items={savedItems.map((i) => ({ ...i, defaultPrice: i.defaultPrice.toString() }))} />
        </CardContent>
      </Card>
    </div>
  );
}
