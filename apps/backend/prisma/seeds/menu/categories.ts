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
    name: "Lavashlar",
    description: "PDF menyudagi mol go'shtli, tovuqli, pishloqli, achchiq va tandir lavashlar.",
    imageUrl: "/categories/lavash.webp",
    sortOrder: 10,
  },
  {
    code: "CHICKEN_LAVASH",
    name: "Tovuqli lavash",
    description: "Legacy tovuqli lavash bo'limi. Canonical katalogda tovuqli lavashlar Lavashlar bo'limida ko'rinadi.",
    imageUrl: "/categories/chicken-lavash.webp",
    sortOrder: 20,
  },
  {
    code: "BURGER",
    name: "Burgerlar",
    description: "PDF menyudagi mol go'shtli va tovuqli burgerlar.",
    imageUrl: "/categories/burger.webp",
    sortOrder: 30,
  },
  {
    code: "CHICKEN_BURGER",
    name: "Tovuqli burgerlar",
    description: "Legacy tovuqli burger bo'limi. Canonical katalogda tovuqli burgerlar Burgerlar bo'limida ko'rinadi.",
    imageUrl: "/categories/chicken-burger.webp",
    sortOrder: 40,
  },
  {
    code: "HOT_DOG",
    name: "Hot Doglar",
    description: "PDF menyudagi salatli, qazili, chicken va shashlikli hot doglar.",
    imageUrl: "/categories/hot-dog.webp",
    sortOrder: 50,
  },
  {
    code: "DONER",
    name: "Doner / Klab / Xaggi",
    description: "PDF menyudagi doner, klab senvich, xaggi va uy uslubidagi mahsulotlar.",
    imageUrl: "/categories/doner.webp",
    sortOrder: 60,
  },
  {
    code: "BLYUDALAR",
    name: "Blyudalar",
    description: "PDF menyudagi tarelka va uy uslubidagi blyudalar.",
    imageUrl: "/categories/doner.webp",
    sortOrder: 65,
  },
  {
    code: "FAST_FOOD",
    name: "Gazaklar",
    description: "PDF menyudagi fri, naggets, kurinniy sharik va boshqa gazaklar.",
    imageUrl: "/categories/fast-food.webp",
    sortOrder: 70,
  },
  {
    code: "DRINKS",
    name: "Ichimliklar",
    description: "Taom va setlar uchun sovuq ichimliklar.",
    imageUrl: "/categories/drinks.webp",
    sortOrder: 80,
  },
  {
    code: "SAUCES",
    name: "Souslar",
    description: "Souslar va qo'shimchalar.",
    imageUrl: "/categories/sauces.webp",
    sortOrder: 90,
  },
  {
    code: "SETS",
    name: "Setlar",
    description: "Foydali setlar va oilaviy to'plamlar.",
    imageUrl: "/categories/sets.webp",
    sortOrder: 100,
  },
];
