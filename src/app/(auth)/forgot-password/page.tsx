"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const schema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
});

const GENERIC_MESSAGE =
  "אם קיים חשבון עם כתובת זו, נשלח אליו קישור לאיפוס סיסמה.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = schema.safeParse({ email });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      await fetch("api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
      // Always show the same generic success message, regardless of response.
      setSubmitted(true);
    } catch {
      // Network errors should also surface the generic message rather than
      // hint at whether the server is reachable for this email.
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">איפוס סיסמה</CardTitle>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <p
                className="text-center text-sm text-green-700 leading-relaxed"
                role="status"
              >
                {GENERIC_MESSAGE}
              </p>
              <Link
                href="/login"
                className="block text-center text-sm text-brand-700 hover:underline"
              >
                חזרה להתחברות
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <p className="text-sm text-slate-600 leading-relaxed">
                הזן את כתובת האימייל שלך, ואם קיים חשבון תואם נשלח אליה קישור לאיפוס סיסמה.
              </p>
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
                {loading ? "שולח..." : "שלח קישור לאיפוס"}
              </Button>
              <Link
                href="/login"
                className="block text-center text-sm text-brand-700 hover:underline"
              >
                חזרה להתחברות
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
