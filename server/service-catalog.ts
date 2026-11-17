import { getStoreSetting, setStoreSetting } from "./db";

export const SERVICE_CATALOGUE_FEATURE = "Service catalogue";
const SERVICE_CATALOGUE_SETTING = "service_catalogue_v1";

export const SERVICE_MODES = [
  "workshop_appointment",
  "on_site",
  "installation",
  "custom_build",
] as const;

export const SERVICE_FEE_KEYS = [
  "diagnosis",
  "labour",
  "parts",
  "materials",
  "travel",
  "delivery",
] as const;

export type ServiceMode = typeof SERVICE_MODES[number];
export type ServiceFeeKey = typeof SERVICE_FEE_KEYS[number];
export type ServiceFeePolicy = "included" | "itemised_quote" | "not_applicable" | "confirm_in_quote";

export interface ServiceCatalogItem {
  id: string;
  name: string;
  description: string;
  mode: ServiceMode;
  feePolicies: Partial<Record<ServiceFeeKey, ServiceFeePolicy>>;
  active: boolean;
}

export interface ServiceCatalogConfig {
  enabled: boolean;
  services: ServiceCatalogItem[];
}

const VALID_FEE_POLICIES = new Set<ServiceFeePolicy>([
  "included",
  "itemised_quote",
  "not_applicable",
  "confirm_in_quote",
]);

export function normalizeServiceCatalog(input: unknown): { config?: ServiceCatalogConfig; error?: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Service catalogue settings must be an object." };
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.services) || raw.services.length > 100) return { error: "Add no more than 100 services." };

  const services: ServiceCatalogItem[] = [];
  const seenIds = new Set<string>();
  for (const value of raw.services) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Each service must be a valid object." };
    const item = value as Record<string, unknown>;
    const id = String(item.id || "").trim().slice(0, 80);
    const name = String(item.name || "").trim();
    const description = String(item.description || "").trim();
    const mode = String(item.mode || "") as ServiceMode;
    if (!id || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) return { error: "Each service needs a valid ID." };
    if (seenIds.has(id)) return { error: "Service IDs must be unique." };
    seenIds.add(id);
    if (!name || name.length > 120) return { error: "Each service needs a name of at most 120 characters." };
    if (!description || description.length > 3000) return { error: "Each service needs a description of at most 3,000 characters." };
    if (!(SERVICE_MODES as readonly string[]).includes(mode)) return { error: `Choose a valid delivery method for ${name}.` };

    const rawPolicies = item.feePolicies && typeof item.feePolicies === "object" && !Array.isArray(item.feePolicies)
      ? item.feePolicies as Record<string, unknown>
      : {};
    const feePolicies: ServiceCatalogItem["feePolicies"] = {};
    for (const key of SERVICE_FEE_KEYS) {
      const policy = rawPolicies[key];
      if (policy === undefined || policy === "") continue;
      if (typeof policy !== "string" || !VALID_FEE_POLICIES.has(policy as ServiceFeePolicy)) {
        return { error: `Choose a valid fee treatment for ${name}.` };
      }
      feePolicies[key] = policy as ServiceFeePolicy;
    }

    services.push({
      id,
      name,
      description,
      mode,
      feePolicies,
      // Publishing is explicit. Missing/unknown values remain hidden.
      active: item.active === true,
    });
  }

  return { config: { enabled: raw.enabled === true, services } };
}

export async function getServiceCatalogConfig(): Promise<ServiceCatalogConfig> {
  try {
    const raw = await getStoreSetting(SERVICE_CATALOGUE_SETTING);
    if (!raw) return { enabled: false, services: [] };
    const parsed = normalizeServiceCatalog(JSON.parse(raw));
    return parsed.config || { enabled: false, services: [] };
  } catch {
    return { enabled: false, services: [] };
  }
}

export async function saveServiceCatalogConfig(input: unknown): Promise<{ config?: ServiceCatalogConfig; error?: string }> {
  const parsed = normalizeServiceCatalog(input);
  if (!parsed.config) return parsed;

  // Never erase a service definition via a partial update; missing entries are
  // retained but hidden. Existing repair tickets keep their captured wording.
  const previous = await getServiceCatalogConfig();
  const currentIds = new Set(parsed.config.services.map((service) => service.id));
  const retained = previous.services
    .filter((service) => !currentIds.has(service.id))
    .map((service) => ({ ...service, active: false }));
  // Keep activation controlled only by its dedicated tenant-admin endpoint;
  // editing or publishing offers cannot silently switch the whole catalogue on.
  const config = { ...parsed.config, enabled: previous.enabled, services: [...parsed.config.services, ...retained] };
  await setStoreSetting(SERVICE_CATALOGUE_SETTING, JSON.stringify(config));
  return { config };
}

export async function setServiceCatalogActivation(enabled: boolean): Promise<ServiceCatalogConfig> {
  const config = await getServiceCatalogConfig();
  const updated = { ...config, enabled };
  await setStoreSetting(SERVICE_CATALOGUE_SETTING, JSON.stringify(updated));
  return updated;
}
