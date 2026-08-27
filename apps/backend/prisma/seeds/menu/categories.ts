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
    description: "Yangi sabzavot va maxsus sousli MAZETTO lavashlari.",
    imageUrl: "/categories/lavash.webp",
    sortOrder: 10,
  },
  {
    code: "CHICKEN_LAVASH",
    name: "Tovuqli lavash",
    description: "Klassik, pishloqli va achchiq tovuqli lavashlar.",
    imageUrl: "/categories/chicken-lavash.webp",
    sortOrder: 20,
  },
  {
    code: "BURGER",
    name: "Burgerlar",
    description: "Mol go'shtli burgerlar: zalda, olib ketish yoki yetkazish uchun.",
    imageUrl: "/categories/burger.webp",
    sortOrder: 30,
  },
  {
    code: "CHICKEN_BURGER",
    name: "Tovuqli burgerlar",
    description: "Qarsildoq va shirali tovuqli burgerlar.",
    imageUrl: "/categories/chicken-burger.webp",
    sortOrder: 40,
  },
  {
    code: "HOT_DOG",
    name: "Hot Dog",
    description: "Tez tayyorlanadigan klassik va to'yimli hot-doglar.",
    imageUrl: "/categories/hot-dog.webp",
    sortOrder: 50,
  },
  {
    code: "DONER",
    name: "Doner",
    description: "Yangi garnirli doner lavash va tarelkalar.",
    imageUrl: "/categories/doner.webp",
    sortOrder: 60,
  },
  {
    code: "FAST_FOOD",
    name: "Gazaklar",
    description: "Fri, strips, naggets va yengil gazaklar.",
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
