import type { CreateMissionInput } from "@cluvvi/core";

function stringValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableNumber(formData: FormData, key: string): number | null {
  const value = stringValue(formData, key);
  if (value.length === 0) {
    return null;
  }
  return Number(value);
}

function listValue(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function missionInputFromFormData(formData: FormData): CreateMissionInput {
  return {
    workspaceId: stringValue(formData, "workspaceId"),
    name: stringValue(formData, "name"),
    websiteUrl: stringValue(formData, "websiteUrl"),
    rawDescription: stringValue(formData, "rawDescription"),
    customerOutcome: stringValue(formData, "customerOutcome"),
    priceMin: nullableNumber(formData, "priceMin"),
    priceMax: nullableNumber(formData, "priceMax"),
    currency: stringValue(formData, "currency") || "USD",
    geographies: listValue(stringValue(formData, "geographies")),
    desiredCount: Number(stringValue(formData, "desiredCount") || "20"),
    exclusions: listValue(stringValue(formData, "exclusions")),
    capacityNotes: stringValue(formData, "capacityNotes") || null,
  };
}
