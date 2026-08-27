import type { MenuProductSeed } from "./products";
import type { MenuVariantSeed } from "./variants";

export type ComboSeed = MenuProductSeed & {
  bundle: string[];
};

export const menuCombos: ComboSeed[] = [
  {
    code: "FAMILY_SET",
    categoryCode: "SETS",
    name: "Oilaviy set",
    description: "Katta lavash, klassik burger, fri va ikkita sovuq ichimlik.",
    basePrice: 119000,
    imageUrl: "/products/set-family.webp",
    preparationTime: 18,
    active: true,
    recommended: true,
    bundle: ["BIG_LAVASH", "CLASSIC_BURGER", "FRIES", "COCA_COLA"],
  },
  {
    code: "LAVASH_SET",
    categoryCode: "SETS",
    name: "Lavash set",
    description: "Tovuqli lavash, fri, sous va ichimlik.",
    basePrice: 54000,
    imageUrl: "/products/set-lavash.webp",
    preparationTime: 13,
    active: true,
    recommended: true,
    bundle: ["CHICKEN_LAVASH", "FRIES", "HOUSE_SAUCE", "COCA_COLA"],
  },
  {
    code: "BURGER_SET",
    categoryCode: "SETS",
    name: "Burger set",
    description: "Klassik burger, fri va ichimlik.",
    basePrice: 49000,
    imageUrl: "/products/set-burger.webp",
    preparationTime: 12,
    active: true,
    bundle: ["CLASSIC_BURGER", "FRIES", "COCA_COLA"],
  },
  {
    code: "KIDS_SET",
    categoryCode: "SETS",
    name: "Bolalar seti",
    description: "Naggets, fri, pishloqli sous va suv.",
    basePrice: 39000,
    imageUrl: "/products/set-kids.webp",
    preparationTime: 10,
    active: true,
    bundle: ["NUGGETS", "FRIES", "CHEESE_SAUCE", "WATER"],
  },
];

export const comboVariants: MenuVariantSeed[] = menuCombos.map((combo) => ({
  productCode: combo.code,
  code: "STANDARD",
  name: "Standart",
  price: combo.basePrice,
  isDefault: true,
  sortOrder: 10,
}));
