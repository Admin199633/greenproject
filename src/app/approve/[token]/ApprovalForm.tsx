"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api-base";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface ApprovalFormProps {
  token: string;
  customerName: string;
}

type FormState = "idle" | "loading" | "success" | "error";

export default function ApprovalForm({
  token,
  customerName,
}: ApprovalFormProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const blankSignatureRef = useRef<string | null>(null);
  const [approvedByName, setApprovedByName] = useState(customerName || "");
  const [accepted, setAccepted] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#0f172a";
    context.lineWidth = 2;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    blankSignatureRef.current = canvas.toDataURL("image/png");
  }, []);

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function persistSignature() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    setSignatureDataUrl(
      dataUrl === blankSignatureRef.current ? null : dataUrl
    );
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const point = getCanvasPoint(event);
    if (!canvas || !context || !point) {
      return;
    }

    isDrawingRef.current = true;
    lastPointRef.current = point;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    persistSignature();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const point = getCanvasPoint(event);
    const lastPoint = lastPointRef.current;
    if (!canvas || !context || !point || !lastPoint) {
      return;
    }

    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
  }

  function finishDrawing() {
    if (!isDrawingRef.current) {
      return;
    }

    isDrawingRef.current = false;
    lastPointRef.current = null;
    persistSignature();
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = approvedByName.trim();
    if (!trimmedName) {
      setState("error");
      setError("יש למלא שם מלא");
      return;
    }

    if (!accepted) {
      setState("error");
      setError("יש לאשר את פרטי ההצעה והתנאים");
      return;
    }

    setState("loading");
    setError("");

    try {
      const res = await fetch(
        `${API_BASE}/public/approve/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            approvedByName: trimmedName,
            signatureDataUrl: signatureDataUrl ?? undefined,
          }),
        }
      );

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setState("error");
        setError(data.error ?? "אירעה שגיאה באישור ההצעה");
        return;
      }

      setState("success");
    } catch {
      setState("error");
      setError("אירעה שגיאת רשת. יש לנסות שוב.");
    }
  }

  if (state === "success") {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center sm:p-6">
        <p className="text-base font-semibold text-emerald-800">
          הצעת המחיר אושרה בהצלחה
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">אישור ההצעה</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        יש למלא שם מלא ולאשר את פרטי ההצעה והתנאים כדי להשלים את האישור.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" dir="rtl">
        <div className="space-y-2">
          <label
            htmlFor="approvedByName"
            className="block text-sm font-medium text-slate-700"
          >
            שם מלא
          </label>
          <Input
            id="approvedByName"
            value={approvedByName}
            onChange={(event) => setApprovedByName(event.target.value)}
            placeholder="הקלד/י שם מלא"
            autoComplete="name"
            className="h-11 text-base"
            disabled={state === "loading"}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-slate-700">
              חתימה
            </label>
            <button
              type="button"
              onClick={clearSignature}
              disabled={state === "loading"}
              className="min-h-[44px] shrink-0 rounded-md px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              נקה חתימה
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <canvas
              ref={canvasRef}
              width={600}
              height={220}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrawing}
              onPointerLeave={finishDrawing}
              onPointerCancel={finishDrawing}
              className="block h-40 w-full touch-none bg-white"
            />
          </div>
          <p className="text-xs text-slate-500">
            ניתן לחתום עם האצבע או עם העכבר. החתימה נשמרת אם הוזנה.
          </p>
        </div>

        <label className="flex min-h-[44px] items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-700">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            disabled={state === "loading"}
          />
          <span>קראתי ואני מאשר/ת את פרטי ההצעה והתנאים</span>
        </label>

        {state === "error" && error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="min-h-[48px] w-full text-base"
          disabled={state === "loading"}
        >
          {state === "loading" ? "מאשר/ת..." : "מאשר/ת את הצעת המחיר"}
        </Button>
      </form>
    </section>
  );
}
