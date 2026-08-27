export type MenuModifierSeed = {
  code: string;
  name: string;
  description: string;
  price: number;
  sortOrder: number;
};

export const menuModifiers: MenuModifierSeed[] = [
  {
    code: "EXTRA_CHEESE",
    name: "Qo'shimcha pishloq",
    description: "Qo'shimcha pishloq porsiyasi.",
    price: 5000,
    sortOrder: 10,
  },
  {
    code: "EXTRA_SAUCE",
    name: "Qo'shimcha sous",
    description: "Qo'shimcha maxsus sous porsiyasi.",
    price: 3000,
    sortOrder: 20,
  },
  {
    code: "SPICY",
    name: "Achchiq",
    description: "Taomni achchiqroq tayyorlash.",
    price: 0,
    sortOrder: 30,
  },
  {
    code: "NO_ONION",
    name: "Piyozsiz",
    description: "Piyozsiz tayyorlash.",
    price: 0,
    sortOrder: 40,
  },
  {
    code: "NO_CUCUMBER",
    name: "Bodringsiz",
    description: "Bodringsiz tayyorlash.",
    price: 0,
    sortOrder: 50,
  },
  {
    code: "ADDITIONAL_MEAT",
    name: "Qo'shimcha go'sht",
    description: "Qo'shimcha go'sht porsiyasi.",
    price: 9000,
    sortOrder: 60,
  },
  {
    code: "BBQ_SAUCE",
    name: "BBQ sous",
    description: "BBQ sous qo'shimchasi.",
    price: 3000,
    sortOrder: 70,
  },
  {
    code: "JALAPENO",
    name: "Jalapeno",
    description: "Maydalangan jalapeno qo'shimchasi.",
    price: 4000,
    sortOrder: 80,
  },
];
