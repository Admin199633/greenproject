"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { API_BASE } from "@/lib/api-base";

interface Props {
  initial: {
    connected: boolean;
    googleEmail: string | null;
    configured: boolean;
  };
}

export default function GoogleCalendarSection({ initial }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connected, setConnected] = useState(initial.connected);
  const [googleEmail, setGoogleEmail] = useState(initial.googleEmail);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<
    | { kind: "success"; text: string }
    | { kind: "error"; text: string }
    | null
  >(null);

  useEffect(() => {
    const calendar = searchParams.get("calendar");
    if (calendar === "connected") {
      setFeedback({ kind: "success", text: "החיבור ליומן Google הושלם בהצלחה" });
    } else if (calendar === "error") {
      const reason = searchParams.get("reason");
      setFeedback({
        kind: "error",
        text:
          reason === "exchange_failed"
            ? "החיבור ליומן Google נכשל בעת אימות מול Google"
            : "החיבור ליומן Google נכשל",
      });
    }
  }, [searchParams]);

  function handleConnect() {
    if (!initial.configured) {
      setFeedback({
        kind: "error",
        text: "OAuth של Google אינו מוגדר. יש להגדיר את GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET ו-GOOGLE_REDIRECT_URI.",
      });
      return;
    }
    window.location.href = `${API_BASE}/integrations/google-calendar/connect`;
  }

  async function handleDisconnect() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/integrations/google-calendar/disconnect`, {
        method: "POST",
      });
      if (!res.ok) {
        setFeedback({ kind: "error", text: "ניתוק נכשל" });
        return;
      }
      setConnected(false);
      setGoogleEmail(null);
      setFeedback({ kind: "success", text: "היומן נותק בהצלחה" });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", text: "שגיאת רשת בעת ניתוק" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 leading-7">
        חיבור ליומן Google של בעל העסק. כשלקוח מאשר הצעת מחיר, ייווצר אירוע ביומן באופן אוטומטי.
      </p>

      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-slate-800">סטטוס חיבור</p>
          {connected ? (
            <p className="mt-1 truncate text-emerald-700">
              מחובר{googleEmail ? ` (${googleEmail})` : ""}
            </p>
          ) : (
            <p className="mt-1 text-slate-500">לא מחובר</p>
          )}
        </div>

        <div className="shrink-0">
          {connected ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleDisconnect}
              disabled={busy}
            >
              {busy ? "מנתק..." : "ניתוק"}
            </Button>
          ) : (
            <Button type="button" onClick={handleConnect} disabled={busy}>
              חבר Google Calendar
            </Button>
          )}
        </div>
      </div>

      {!initial.configured && !connected && (
        <p className="text-xs leading-6 text-amber-700">
          שים/י לב: יש להגדיר את משתני הסביבה GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET ו-GOOGLE_REDIRECT_URI לפני שניתן יהיה להתחבר.
        </p>
      )}

      {feedback && (
        <p
          className={
            feedback.kind === "success"
              ? "text-sm text-emerald-700"
              : "text-sm text-red-700"
          }
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
