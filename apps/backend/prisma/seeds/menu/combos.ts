import type { MenuProductSeed } from "./products";
import type { MenuVariantSeed } from "./variants";

export type ComboSeed = MenuProductSeed & {
  bundle: string[];
};

export const menuCombos: ComboSeed[] = [
  {
    code: "FAMILY_SET",
    categoryCode: "SETS",
    name: "Family Set",
    description: "Big Lavash, Classic Burger, French Fries, and two cold drinks.",
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
    name: "Lavash Set",
    description: "Chicken Lavash with fries, sauce, and drink.",
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
    name: "Burger Set",
    description: "Classic Burger with fries and drink.",
    basePrice: 49000,
    imageUrl: "/products/set-burger.webp",
    preparationTime: 12,
    active: true,
    bundle: ["CLASSIC_BURGER", "FRIES", "COCA_COLA"],
  },
  {
    code: "KIDS_SET",
    categoryCode: "SETS",
    name: "Kids Set",
    description: "Nuggets with fries, cheese sauce, and water.",
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
  name: "Standard",
  price: combo.basePrice,
  isDefault: true,
  sortOrder: 10,
}));
