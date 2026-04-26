import { forwardRef, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));

Select.displayName = "Select";
export { Select };
