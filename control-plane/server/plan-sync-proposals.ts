export interface ClientPlanProposal {
  id: string;
  name: string;
  description: string;
  price: number;
  priceAnnual: number | null;
  tierLevel: number;
  maxProducts: number;
  maxBranches: number;
  features: string[];
  isActive: boolean;
  syncToOthers: true;
}

export function normalizeClientPlanProposal(value: unknown): ClientPlanProposal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.syncToOthers !== true) return null;

  const id = typeof source.id === "string" ? source.id.trim() : "";
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const description = source.description === undefined ? "" : source.description;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(id) || !name || name.length > 100) return null;
  if (typeof description !== "string" || description.length > 2000) return null;

  const finiteNonNegative = (input: unknown, fallback: number): number | null => {
    if (input === undefined || input === null) return fallback;
    const number = Number(input);
    return Number.isFinite(number) && number >= 0 ? number : null;
  };
  const boundedInt = (input: unknown, fallback: number, max: number): number | null => {
    const number = input === undefined || input === null ? fallback : Number(input);
    return Number.isSafeInteger(number) && number >= 0 && number <= max ? number : null;
  };

  const price = finiteNonNegative(source.price, 0);
  const priceAnnual = finiteNonNegative(source.priceAnnual, 0);
  const tierLevel = boundedInt(source.tierLevel, 1, 100);
  const maxProducts = boundedInt(source.maxProducts, 50, 1000000);
  const maxBranches = boundedInt(source.maxBranches, 1, 10000);
  if (price === null || priceAnnual === null || tierLevel === null || maxProducts === null || maxBranches === null) return null;
  if (source.isActive !== undefined && typeof source.isActive !== "boolean") return null;
  if (source.features !== undefined && (!Array.isArray(source.features) || source.features.length > 100 || source.features.some((feature) => typeof feature !== "string" || feature.length > 120))) return null;

  return {
    id,
    name,
    description,
    price,
    priceAnnual: priceAnnual || null,
    tierLevel,
    maxProducts,
    maxBranches,
    features: (source.features as string[] | undefined) || [],
    isActive: source.isActive === undefined ? true : source.isActive,
    syncToOthers: true,
  };
}
