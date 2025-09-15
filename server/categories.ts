interface Category {
  id: string;
  label: string;
  group: string;
}

const CATEGORIES: Category[] = [
  { id: "gaming-laptops", label: "Gaming Laptops", group: "Laptops" },
  { id: "windows-laptops", label: "Windows Laptops", group: "Laptops" },
  { id: "mac-laptops", label: "Mac Laptops", group: "Laptops" },
  { id: "gaming-pcs", label: "Gaming PCs", group: "PCs" },
  { id: "business-pcs", label: "Business PCs", group: "PCs" },
  { id: "mac-desktops", label: "Mac Desktops", group: "PCs" },
  { id: "rack-servers", label: "Rack Servers", group: "Servers" },
  { id: "tower-servers", label: "Tower Servers", group: "Servers" },
  { id: "blade-servers", label: "Blade Servers", group: "Servers" },
  { id: "printers", label: "Printers", group: "Printers" },
  { id: "repairs", label: "Repairs", group: "Services" },
];

const CATEGORY_IDS: Set<string> = new Set(CATEGORIES.map((c) => c.id));

function isValidCategory(id: string): boolean {
  return CATEGORY_IDS.has(id);
}

export { CATEGORIES, CATEGORY_IDS, isValidCategory };
