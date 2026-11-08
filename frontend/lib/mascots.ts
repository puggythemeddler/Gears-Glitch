export const MASCOT_OPTIONS = [
  { id: "gearhead", name: "GearHead", group: "GearHead", description: "The original workshop companion." },
  { id: "kenya-gearhead", name: "Kenya GearHead", group: "East Africa", description: "GearHead in Kenyan national colours." },
  { id: "uganda-gearhead", name: "Uganda GearHead", group: "East Africa", description: "GearHead in Ugandan national colours." },
  { id: "tanzania-gearhead", name: "Tanzania GearHead", group: "East Africa", description: "GearHead in Tanzanian national colours." },
  { id: "lion", name: "Lion", group: "Wildlife", description: "A bold, friendly lion." },
  { id: "elephant", name: "Elephant", group: "Wildlife", description: "A gentle, curious elephant." },
  { id: "leopard", name: "Leopard", group: "Wildlife", description: "A confident spotted leopard." },
  { id: "rhino", name: "Rhino", group: "Wildlife", description: "A sturdy, good-natured rhino." },
  { id: "buffalo", name: "Buffalo", group: "Wildlife", description: "A calm, dependable buffalo." },
  { id: "zebra", name: "Zebra", group: "Wildlife", description: "A bright, distinctive zebra." },
  { id: "cat", name: "Workshop Cat", group: "Wildlife", description: "A curious little shop cat." },
  { id: "none", name: "No mascot", group: "Other", description: "Remove mascots from the storefront." },
] as const;

export type MascotId = (typeof MASCOT_OPTIONS)[number]["id"];

export function isMascotId(value: unknown): value is MascotId {
  return typeof value === "string" && MASCOT_OPTIONS.some((option) => option.id === value);
}
