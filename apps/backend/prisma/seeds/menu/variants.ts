import { menuProducts } from "./products";

export type MenuVariantSeed = {
  productCode: string;
  code: string;
  name: string;
  price: number;
  costPrice?: number;
  isDefault?: boolean;
  sortOrder: number;
};

const legacyDrinkVariants: MenuVariantSeed[] = [
  {
    productCode: "COCA_COLA",
    code: "500ML",
    name: "500 ml",
    price: 9000,
    costPrice: 6500,
    isDefault: true,
    sortOrder: 10,
  },
  {
    productCode: "COCA_COLA",
    code: "1L",
    name: "1 L",
    price: 14000,
    costPrice: 10000,
    sortOrder: 20,
  },
  {
    productCode: "FANTA",
    code: "500ML",
    name: "500 ml",
    price: 9000,
    costPrice: 6500,
    isDefault: true,
    sortOrder: 10,
  },
  {
    productCode: "FANTA",
    code: "1L",
    name: "1 L",
    price: 14000,
    costPrice: 10000,
    sortOrder: 20,
  },
  {
    productCode: "SPRITE",
    code: "500ML",
    name: "500 ml",
    price: 9000,
    costPrice: 6500,
    isDefault: true,
    sortOrder: 10,
  },
  {
    productCode: "SPRITE",
    code: "1L",
    name: "1 L",
    price: 14000,
    costPrice: 10000,
    sortOrder: 20,
  },
  {
    productCode: "WATER",
    code: "500ML",
    name: "500 ml",
    price: 5000,
    costPrice: 3000,
    isDefault: true,
    sortOrder: 10,
  },
  {
    productCode: "WATER",
    code: "1L",
    name: "1 L",
    price: 8000,
    costPrice: 5000,
    sortOrder: 20,
  },
];

const productsWithExplicitVariants = new Set(legacyDrinkVariants.map((variant) => variant.productCode));

export const menuVariants: MenuVariantSeed[] = [
  ...legacyDrinkVariants,
  ...menuProducts
    .filter((product) => !productsWithExplicitVariants.has(product.code))
    .map((product) => ({
      productCode: product.code,
      code: "STANDARD",
      name: "Standart",
      price: product.basePrice,
      isDefault: true,
      sortOrder: 10,
    })),
];
