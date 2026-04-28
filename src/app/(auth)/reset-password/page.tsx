"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const schema = z
  .object({
    password: z.string().min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
    confirmPassword: z.string().min(1, "יש לאשר את הסיסמה"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirmPassword"],
  });

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-center text-sm text-red-600 leading-relaxed" role="alert">
          הקישור לא תקין או חסר. יש לבקש קישור חדש.
        </p>
        <Link
          href="/forgot-password"
          className="block text-center text-sm text-brand-700 hover:underline"
        >
          בקשת קישור חדש
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = schema.safeParse({ password, confirmPassword });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password, confirmPassword }),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        router.push("/login?passwordReset=1");
        return;
      }

      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(data?.error ?? "לא ניתן היה לאפס סיסמה");
    } catch {
      setError("שגיאת תקשורת, נסה שנית");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-slate-600 leading-relaxed">
        בחר סיסמה חדשה לחשבון שלך. הקישור בתוקף ל-30 דקות מרגע הבקשה.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="password">סיסמה חדשה</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">אימות סיסמה</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
        />
      </div>
      {error && (
        <p className="text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "מעדכן..." : "עדכון סיסמה"}
      </Button>
      <Link
        href="/login"
        className="block text-center text-sm text-brand-700 hover:underline"
      >
        חזרה להתחברות
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">בחירת סיסמה חדשה</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <ResetPasswordInner />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
