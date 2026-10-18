export const BUSINESS_CATEGORIES = [
  ["tailoring", "Tailoring & clothing alterations"],
  ["food", "Restaurants, cafés & food service"],
  ["dairy", "Dairy shops"],
  ["beauty", "Beauty & hair salons"],
  ["repair", "Phone shops & electronics repair"],
  ["agriculture", "Agricultural inputs"],
  ["poultry", "Farm products & meat shops"],
  ["grocery", "Grocery & convenience stores"],
  ["bakery", "Bakeries"],
  ["clothing", "Clothing shops"],
  ["digital", "Advertising & IT offices"],
  ["craft", "Craft & gift shops"],
] as const;
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number][0];
