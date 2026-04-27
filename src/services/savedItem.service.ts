import { db } from "@/lib/db";
import { perf } from "@/lib/perf";
import type { SavedItemInput } from "@/lib/validations/savedItem";

export async function listSavedItems(businessId: string) {
  return perf("savedItem.listSavedItems", () =>
    db.savedItem.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
    })
  );
}

export async function createSavedItem(businessId: string, data: SavedItemInput) {
  return db.savedItem.create({
    data: {
      businessId,
      name: data.name.trim(),
      description: data.description?.trim() || "",
      defaultPrice: data.defaultPrice ?? 0,
      unit: data.unit?.trim() || "",
    },
  });
}

export async function updateSavedItem(
  id: string,
  businessId: string,
  data: SavedItemInput
) {
  const item = await db.savedItem.findFirst({ where: { id, businessId } });
  if (!item) return null;

  return db.savedItem.update({
    where: { id },
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || "",
      defaultPrice: data.defaultPrice ?? 0,
      unit: data.unit?.trim() || "",
    },
  });
}

export async function deleteSavedItem(id: string, businessId: string) {
  const item = await db.savedItem.findFirst({ where: { id, businessId } });
  if (!item) return null;

  return db.savedItem.delete({ where: { id } });
}