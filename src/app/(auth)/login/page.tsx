"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const loginSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
  password: z.string().min(6, "סיסמה חייבת להכיל לפחות 6 תווים"),
});

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const registered = searchParams.get("registered") === "1";
  const passwordReset = searchParams.get("passwordReset") === "1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError("אימייל או סיסמה שגויים");
      }
    } catch {
      setError("שגיאת תקשורת, נסה שנית");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">כניסה למערכת</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
                dir="ltr"
                className="text-left"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <Link
                href="/forgot-password"
                className="block text-sm text-brand-700 hover:underline"
              >
                שכחתי סיסמה
              </Link>
            </div>
            {registered && (
              <p className="text-center text-sm text-green-700" role="status">
                החשבון נוצר בהצלחה. אפשר להתחבר עכשיו.
              </p>
            )}
            {passwordReset && (
              <p className="text-center text-sm text-green-700" role="status">
                הסיסמה עודכנה בהצלחה. אפשר להתחבר עם הסיסמה החדשה.
              </p>
            )}
            {error && (
              <p className="text-center text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? "מתחבר..." : "כניסה"}
            </Button>
            <Link
              href="/register"
              className="block text-center text-sm text-brand-700 hover:underline"
            >
              הרשמה
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
