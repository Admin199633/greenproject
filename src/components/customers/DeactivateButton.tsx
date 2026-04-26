"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { deactivateCustomerAction } from "@/app/(dashboard)/customers/actions";

export default function DeactivateButton({
  customerId,
}: {
  customerId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("האם לבטל לקוח זה?\nהלקוח לא יופיע יותר ברשימה ולא ניתן יהיה לשייך אליו מסמכים חדשים."))
      return;

    startTransition(async () => {
      const result = await deactivateCustomerAction(customerId);
      if (result?.error) {
        alert(result.error);
      }
    });
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "מבטל..." : "בטל לקוח"}
    </Button>
  );
}
