export type MenuCategorySeed = {
  code: string;
  name: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
};

export const menuCategories: MenuCategorySeed[] = [
  {
    code: "LAVASH",
    name: "Lavash",
    description: "Signature MAZETTO lavash wraps with fresh vegetables and house sauces.",
    imageUrl: "/categories/lavash.webp",
    sortOrder: 10,
  },
  {
    code: "CHICKEN_LAVASH",
    name: "Chicken Lavash",
    description: "Tender chicken lavash options with cheese, spicy, and classic flavors.",
    imageUrl: "/categories/chicken-lavash.webp",
    sortOrder: 20,
  },
  {
    code: "BURGER",
    name: "Burger",
    description: "Beef burgers prepared for dine-in, pickup, and delivery.",
    imageUrl: "/categories/burger.webp",
    sortOrder: 30,
  },
  {
    code: "CHICKEN_BURGER",
    name: "Chicken Burger",
    description: "Crispy and grilled chicken burgers with MAZETTO sauces.",
    imageUrl: "/categories/chicken-burger.webp",
    sortOrder: 40,
  },
  {
    code: "HOT_DOG",
    name: "Hot Dog",
    description: "Classic and loaded hot dogs for quick service.",
    imageUrl: "/categories/hot-dog.webp",
    sortOrder: 50,
  },
  {
    code: "DONER",
    name: "Doner",
    description: "Doner plates and wraps with fresh sides.",
    imageUrl: "/categories/doner.webp",
    sortOrder: 60,
  },
  {
    code: "FAST_FOOD",
    name: "Fast Food",
    description: "Fries, snacks, strips, and sides.",
    imageUrl: "/categories/fast-food.webp",
    sortOrder: 70,
  },
  {
    code: "DRINKS",
    name: "Drinks",
    description: "Cold beverages for meals and sets.",
    imageUrl: "/categories/drinks.webp",
    sortOrder: 80,
  },
  {
    code: "SAUCES",
    name: "Sauces",
    description: "Reusable sauces and dips.",
    imageUrl: "/categories/sauces.webp",
    sortOrder: 90,
  },
  {
    code: "SETS",
    name: "Sets",
    description: "Combo meals and family bundles.",
    imageUrl: "/categories/sets.webp",
    sortOrder: 100,
  },
];
