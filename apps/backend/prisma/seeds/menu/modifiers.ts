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
    name: "Extra cheese",
    description: "Additional cheese portion.",
    price: 5000,
    sortOrder: 10,
  },
  {
    code: "EXTRA_SAUCE",
    name: "Extra sauce",
    description: "Extra house sauce portion.",
    price: 3000,
    sortOrder: 20,
  },
  {
    code: "SPICY",
    name: "Spicy",
    description: "Make the item spicy.",
    price: 0,
    sortOrder: 30,
  },
  {
    code: "NO_ONION",
    name: "No onion",
    description: "Prepare without onion.",
    price: 0,
    sortOrder: 40,
  },
  {
    code: "NO_CUCUMBER",
    name: "No cucumber",
    description: "Prepare without cucumber.",
    price: 0,
    sortOrder: 50,
  },
  {
    code: "ADDITIONAL_MEAT",
    name: "Additional meat",
    description: "Extra meat portion.",
    price: 9000,
    sortOrder: 60,
  },
  {
    code: "BBQ_SAUCE",
    name: "BBQ sauce",
    description: "BBQ sauce add-on.",
    price: 3000,
    sortOrder: 70,
  },
  {
    code: "JALAPENO",
    name: "Jalapeno",
    description: "Sliced jalapeno add-on.",
    price: 4000,
    sortOrder: 80,
  },
];
