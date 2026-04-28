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
    context.strokeStyle = "#3f2d1f";
    context.lineWidth = 2.5;
    context.fillStyle = "#fffdfb";
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
    setSignatureDataUrl(dataUrl === blankSignatureRef.current ? null : dataUrl);
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
    context.fillStyle = "#fffdfb";
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
      <section className="rounded-[2rem] border border-emerald-200/80 bg-[linear-gradient(135deg,#f3fbf7_0%,#fbfffd_100%)] p-6 text-center shadow-[0_22px_60px_rgba(16,185,129,0.12)]">
        <p className="text-[11px] font-medium tracking-[0.22em] text-emerald-700">
          APPROVED
        </p>
        <p className="mt-3 text-2xl font-semibold text-slate-900">
          הצעת המחיר אושרה בהצלחה
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-[#eadfd3] bg-[linear-gradient(180deg,#fffdfb_0%,#fff7f0_100%)] p-5 shadow-[0_28px_90px_rgba(15,23,42,0.09)] ring-1 ring-white/70 sm:p-8">
      <div className="max-w-2xl">
        <p className="text-[11px] font-medium tracking-[0.22em] text-[#9a7b5c]">
          אישור סופי
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          אישור ההצעה
        </h2>
        <p className="mt-3 text-sm leading-8 text-slate-600">
          יש לעבור על הפרטים, לאשר את התנאים ולמלא את שמך המלא לפני שליחת
          האישור.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-5" dir="rtl">
        <div className="rounded-[1.5rem] border border-[#ece1d5] bg-white/90 p-4 shadow-[0_12px_30px_rgba(148,163,184,0.08)] sm:p-5">
          <label
            htmlFor="approvedByName"
            className="block text-sm font-medium text-slate-800"
          >
            שם מלא
          </label>
          <Input
            id="approvedByName"
            value={approvedByName}
            onChange={(event) => setApprovedByName(event.target.value)}
            placeholder="הקלד/י שם מלא"
            autoComplete="name"
            className="mt-3 h-12 rounded-xl border-[#dfd2c4] bg-[#fffdfb] px-4 text-base"
            disabled={state === "loading"}
          />
        </div>

        <div className="rounded-[1.5rem] border border-[#ece1d5] bg-white/90 p-4 shadow-[0_12px_30px_rgba(148,163,184,0.08)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-800">
                חתימה
              </label>
              <p className="mt-1 text-xs leading-6 text-slate-500">
                חתימה אופציונלית עם האצבע או עם העכבר.
              </p>
            </div>
            <button
              type="button"
              onClick={clearSignature}
              disabled={state === "loading"}
              className="min-h-[44px] shrink-0 rounded-xl border border-[#eadfd3] bg-[#fffaf5] px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-[#fff3e6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              נקה חתימה
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[#e9ddcf] bg-[#fffdfb] shadow-inner">
            <canvas
              ref={canvasRef}
              width={600}
              height={220}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrawing}
              onPointerLeave={finishDrawing}
              onPointerCancel={finishDrawing}
              className="block h-40 w-full touch-none bg-[#fffdfb]"
            />
          </div>
        </div>

        <label className="flex min-h-[52px] items-start gap-3 rounded-[1.5rem] border border-[#ece1d5] bg-white/90 px-4 py-4 text-sm leading-7 text-slate-700 shadow-[0_12px_30px_rgba(148,163,184,0.08)] sm:px-5">
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
          <p className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-4 text-sm leading-7 text-red-700">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="min-h-[56px] w-full rounded-[1.5rem] bg-[linear-gradient(135deg,#8a6648_0%,#6b4c34_100%)] text-base font-semibold text-white shadow-[0_20px_55px_rgba(107,76,52,0.28)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#8a6648_0%,#6b4c34_100%)]"
          disabled={state === "loading"}
        >
          {state === "loading" ? "מאשר/ת..." : "מאשר/ת את הצעת המחיר"}
        </Button>
      </form>
    </section>
  );
}
