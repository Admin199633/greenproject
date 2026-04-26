"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";

export default function CustomerSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) {
        params.set("q", query.trim());
      } else {
        params.delete("q");
      }
      router.replace(`${pathname}?${params.toString()}`);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, pathname, router, searchParams]);

  return (
    <Input
      type="search"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="חיפוש לפי שם, חברה, אימייל או טלפון..."
      className="max-w-sm"
      aria-label="חיפוש לקוחות"
    />
  );
}
