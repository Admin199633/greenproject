"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const registerSchema = z
  .object({
    email: z.string().email("כתובת אימייל לא תקינה"),
    password: z.string().min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
    confirmPassword: z.string().min(1, "יש לאשר את הסיסמה"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirmPassword"],
  });

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = registerSchema.safeParse({ email, password, confirmPassword });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, confirmPassword }),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        router.push("/login?registered=1");
        return;
      }

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "לא ניתן היה ליצור חשבון");
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
          <CardTitle className="text-center text-xl">הרשמה למערכת</CardTitle>
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
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? "יוצר חשבון..." : "יצירת חשבון"}
            </Button>
            <Link
              href="/login"
              className="block text-center text-sm text-brand-700 hover:underline"
            >
              חזרה להתחברות
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
