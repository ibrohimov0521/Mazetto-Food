"use client";

import type { Category, CustomerHome, HomepageHeroSlide, HomepagePromotion, ModifierLink, Product, ProductVariant } from "./types";

const categoryLabels: Record<string, string> = {
  LAVASH: "Lavashlar",
  CHICKEN_LAVASH: "Tovuqli lavash",
  BURGER: "Burgerlar",
  CHICKEN_BURGER: "Tovuqli burgerlar",
  HOT_DOG: "Hot Doglar",
  DONER: "Doner / Klab / Xaggi",
  BLYUDALAR: "Blyudalar",
  FAST_FOOD: "Gazaklar",
  DRINKS: "Ichimliklar",
  SAUCES: "Souslar",
  SETS: "Setlar",
};

const productLabels: Record<string, string> = {
  BIG_LAVASH: "Katta lavash",
  CLASSIC_LAVASH: "Klassik lavash",
  MINI_LAVASH: "Mini lavash",
  BEEF_LAVASH: "Mol go'shtli lavash",
  CHICKEN_LAVASH: "Tovuqli lavash",
  CHICKEN_CHEESE_LAVASH: "Tovuqli pishloqli lavash",
  CHICKEN_SPICY_LAVASH: "Tovuqli achchiq lavash",
  CLASSIC_BURGER: "Klassik burger",
  BIG_BURGER: "Katta burger",
  CHEESEBURGER: "Chizburger",
  DOUBLE_BURGER: "Double burger",
  CHICKEN_BURGER: "Tovuqli burger",
  CRISPY_CHICKEN_BURGER: "Qarsildoq tovuqli burger",
  CHICKEN_CHEESEBURGER: "Tovuqli chizburger",
  CLASSIC_HOT_DOG: "Klassik hot-dog",
  CHEESE_HOT_DOG: "Pishloqli hot-dog",
  DOUBLE_HOT_DOG: "Double hot-dog",
  DONER_WRAP: "Doner lavash",
  DONER_PLATE: "Doner tarelka",
  CHICKEN_DONER: "Tovuqli doner",
  FRIES: "Fri kartoshka",
  CHEESE_FRIES: "Pishloqli fri",
  CHICKEN_STRIPS: "Tovuqli strips",
  NUGGETS: "Naggets",
  COCA_COLA: "Coca-Cola",
  FANTA: "Fanta",
  SPRITE: "Sprite",
  WATER: "Suv",
  HOUSE_SAUCE: "Maxsus sous",
  CHEESE_SAUCE: "Pishloqli sous",
  SPICY_SAUCE: "Achchiq sous",
  FAMILY_SET: "Oilaviy set",
  LAVASH_SET: "Lavash set",
  BURGER_SET: "Burger set",
  KIDS_SET: "Bolalar seti",
};

const productDescriptions: Record<string, string> = {
  BIG_LAVASH: "Katta lavash: go'sht, sabzavot, fri va MAZETTO maxsus sousi.",
  CLASSIC_LAVASH: "Klassik lavash: go'sht, yangi sabzavot va maxsus sous.",
  MINI_LAVASH: "Yengil porsiyali mini lavash.",
  BEEF_LAVASH: "Mol go'shti, sabzavot, fri va maxsus sousli lavash.",
  CHICKEN_LAVASH: "Tovuq go'shti, yangi sabzavot va MAZETTO sousli lavash.",
  CHICKEN_CHEESE_LAVASH: "Tovuq go'shti, qo'shimcha pishloq va qaymoqli sousli lavash.",
  CHICKEN_SPICY_LAVASH: "Jalapeno va maxsus sousli achchiq tovuqli lavash.",
  CLASSIC_BURGER: "Mol go'shtli kotlet, sabzavot, pishloq va MAZETTO sousli burger.",
  BIG_BURGER: "Ikki baravar to'yimli katta mol go'shtli burger.",
  CHEESEBURGER: "Mol go'shti, pishloq, marinadlangan bodring va sousli burger.",
  DOUBLE_BURGER: "Ikki kotlet, pishloq va MAZETTO sousli burger.",
  CHICKEN_BURGER: "Tovuq go'shti, sabzavot va maxsus sousli burger.",
  CRISPY_CHICKEN_BURGER: "Qarsildoq tovuq filesi va qaymoqli sousli burger.",
  CHICKEN_CHEESEBURGER: "Tovuq go'shti, pishloq va MAZETTO sousli burger.",
  CLASSIC_HOT_DOG: "Sosiska, sabzavot, ketchup va mayonezli hot-dog.",
  CHEESE_HOT_DOG: "Pishloq va sousli issiq hot-dog.",
  DOUBLE_HOT_DOG: "Ikki sosiska bilan yanada to'yimli hot-dog.",
  DONER_WRAP: "Doner go'shti, sabzavot va sousli o'ralma.",
  DONER_PLATE: "Doner go'shti, fri, salat va sous bilan.",
  CHICKEN_DONER: "Tovuqli doner, garnir va sous bilan.",
  FRIES: "Qarsildoq fri kartoshka.",
  CHEESE_FRIES: "Pishloqli sous bilan fri kartoshka.",
  CHICKEN_STRIPS: "Sous bilan beriladigan qarsildoq tovuq stripslari.",
  NUGGETS: "Sous bilan beriladigan tovuqli naggetslar.",
  COCA_COLA: "Sovutilgan Coca-Cola ichimligi.",
  FANTA: "Sovutilgan Fanta ichimligi.",
  SPRITE: "Sovutilgan Sprite ichimligi.",
  WATER: "Gazsiz ichimlik suvi.",
  HOUSE_SAUCE: "MAZETTO maxsus sousi.",
  CHEESE_SAUCE: "Pishloqli sous.",
  SPICY_SAUCE: "Achchiq sous.",
  FAMILY_SET: "Katta lavash, klassik burger, fri va ikkita sovuq ichimlik.",
  LAVASH_SET: "Tovuqli lavash, fri, sous va ichimlik.",
  BURGER_SET: "Klassik burger, fri va ichimlik.",
  KIDS_SET: "Naggets, fri, pishloqli sous va suv.",
};

const variantLabels: Record<string, string> = {
  STANDARD: "Standart",
  CHEESE: "Pishloqli",
  SPICY: "Achchiq",
  DOUBLE_CHEESE: "Double pishloq",
  "500ML": "500 ml",
  "1L": "1 L",
};

const modifierLabels: Record<string, string> = {
  EXTRA_CHEESE: "Qo'shimcha pishloq",
  EXTRA_SAUCE: "Qo'shimcha sous",
  SPICY: "Achchiq",
  NO_ONION: "Piyozsiz",
  NO_CUCUMBER: "Bodringsiz",
  ADDITIONAL_MEAT: "Qo'shimcha go'sht",
  BBQ_SAUCE: "BBQ sous",
  JALAPENO: "Jalapeno",
};

export function displayCategory(category: Category): Category {
  const nextCategory: Category = {
    ...category,
    name: category.code ? categoryLabels[category.code] ?? category.name : category.name,
  };

  if (category.description != null) {
    nextCategory.description = localizeCategoryDescription(category) ?? category.description;
  }

  return nextCategory;
}

export function displayProduct(product: Product): Product {
  const nextProduct: Product = {
    ...product,
    modifiers: product.modifiers.map(displayModifierLink),
    name: product.name,
    variants: product.variants.map(displayVariant),
  };

  if (product.category !== undefined) {
    nextProduct.category = product.category ? displayProductCategory(product.category) : product.category;
  }

  if (product.description != null) {
    nextProduct.description = product.description;
  }

  return nextProduct;
}

export function displayProducts(products: Product[]): Product[] {
  return products.map(displayProduct);
}

export function displayCustomerHome(home: CustomerHome): CustomerHome {
  return {
    heroSlides: home.heroSlides.map(displayHeroSlide),
    promotions: home.promotions.map(displayPromotion),
  };
}

export function localizeMenuName(value: string | null | undefined): string {
  return value ? displayKnownTitle(value) : "";
}

export function localizeMenuDescription(value: string | null | undefined): string | null | undefined {
  return value ? displayKnownDescription(value) : value;
}

export function displayVariant(variant: ProductVariant): ProductVariant {
  return { ...variant, name: variantLabels[variant.code ?? variant.name.toUpperCase()] ?? variant.name };
}

export function displayModifierLink(link: ModifierLink): ModifierLink {
  return {
    ...link,
    modifier: {
      ...link.modifier,
      name: link.modifier.code ? modifierLabels[link.modifier.code] ?? link.modifier.name : link.modifier.name,
    },
  };
}

function displayProductCategory(category: NonNullable<Product["category"]>): NonNullable<Product["category"]> {
  return {
    ...category,
    name: category.code ? categoryLabels[category.code] ?? category.name : category.name,
  };
}

function displayHeroSlide(slide: HomepageHeroSlide): HomepageHeroSlide {
  const product = slide.product ? displayProductSummary(slide.product) : slide.product;

  const nextSlide: HomepageHeroSlide = {
    ...slide,
    title: displayKnownTitle(slide.title),
  };

  if (product !== undefined) {
    nextSlide.product = product;
  }

  if (slide.subtitle != null || product?.name) {
    nextSlide.subtitle = slide.subtitle ?? product?.name ?? null;
  }

  return nextSlide;
}

function displayPromotion(promotion: HomepagePromotion): HomepagePromotion {
  const product = promotion.product ? displayProductSummary(promotion.product) : promotion.product;

  const nextPromotion: HomepagePromotion = {
    ...promotion,
    title: displayKnownTitle(promotion.title),
  };

  if (promotion.category !== undefined) {
    nextPromotion.category = promotion.category
      ? {
          ...promotion.category,
          name: displayKnownTitle(promotion.category.name),
        }
      : promotion.category;
  }

  if (promotion.description != null) {
    nextPromotion.description = displayKnownDescription(promotion.description) ?? promotion.description;
  }

  if (product !== undefined) {
    nextPromotion.product = product;
  }

  return nextPromotion;
}

function displayProductSummary<T extends Pick<Product, "id" | "name" | "imageUrl" | "sellingPrice" | "preparationTime" | "isCombo">>(product: T): T {
  return {
    ...product,
    name: product.name,
  };
}

function displayKnownTitle(value: string): string {
  const match = Object.entries(productLabels).find(([, label]) => label === value);

  if (match) {
    return match[1];
  }

  const bySeedName = Object.entries(seedProductNames).find(([, seedName]) => seedName === value);
  return bySeedName ? productLabels[bySeedName[0]] ?? value : value;
}

function displayKnownDescription(value: string): string {
  const match = Object.entries(seedProductDescriptions).find(([, seedDescription]) => seedDescription === value);
  return match ? productDescriptions[match[0]] ?? value : value;
}

function localizeCategoryDescription(category: Category): string | null | undefined {
  const descriptions: Record<string, string> = {
    LAVASH: "PDF menyudagi mol go'shtli, tovuqli, pishloqli, achchiq va tandir lavashlar.",
    CHICKEN_LAVASH: "Legacy tovuqli lavash bo'limi.",
    BURGER: "PDF menyudagi mol go'shtli va tovuqli burgerlar.",
    CHICKEN_BURGER: "Legacy tovuqli burger bo'limi.",
    HOT_DOG: "PDF menyudagi salatli, qazili, chicken va shashlikli hot doglar.",
    DONER: "PDF menyudagi doner, klab senvich, xaggi va uy uslubidagi mahsulotlar.",
    BLYUDALAR: "PDF menyudagi tarelka va uy uslubidagi blyudalar.",
    FAST_FOOD: "PDF menyudagi fri, naggets, kurinniy sharik va boshqa gazaklar.",
    DRINKS: "Taom va setlar uchun sovuq ichimliklar.",
    SAUCES: "Souslar va qo'shimchalar.",
    SETS: "Foydali setlar va oilaviy to'plamlar.",
  };

  return category.code ? descriptions[category.code] ?? category.description : category.description;
}

const seedProductNames: Record<string, string> = {
  BIG_LAVASH: "Big Lavash",
  CLASSIC_LAVASH: "Classic Lavash",
  MINI_LAVASH: "Mini Lavash",
  BEEF_LAVASH: "Beef Lavash",
  CHICKEN_LAVASH: "Chicken Lavash",
  CHICKEN_CHEESE_LAVASH: "Chicken Cheese Lavash",
  CHICKEN_SPICY_LAVASH: "Chicken Spicy Lavash",
  CLASSIC_BURGER: "Classic Burger",
  BIG_BURGER: "Big Burger",
  CHEESEBURGER: "Cheeseburger",
  DOUBLE_BURGER: "Double Burger",
  CHICKEN_BURGER: "Chicken Burger",
  CRISPY_CHICKEN_BURGER: "Crispy Chicken Burger",
  CHICKEN_CHEESEBURGER: "Chicken Cheeseburger",
  CLASSIC_HOT_DOG: "Classic Hot Dog",
  CHEESE_HOT_DOG: "Cheese Hot Dog",
  DOUBLE_HOT_DOG: "Double Hot Dog",
  DONER_WRAP: "Doner Wrap",
  DONER_PLATE: "Doner Plate",
  CHICKEN_DONER: "Chicken Doner",
  FRIES: "French Fries",
  CHEESE_FRIES: "Cheese Fries",
  CHICKEN_STRIPS: "Chicken Strips",
  NUGGETS: "Nuggets",
  COCA_COLA: "Coca-Cola",
  FANTA: "Fanta",
  SPRITE: "Sprite",
  WATER: "Water",
  HOUSE_SAUCE: "House Sauce",
  CHEESE_SAUCE: "Cheese Sauce",
  SPICY_SAUCE: "Spicy Sauce",
  FAMILY_SET: "Family Set",
  LAVASH_SET: "Lavash Set",
  BURGER_SET: "Burger Set",
  KIDS_SET: "Kids Set",
};

const seedProductDescriptions: Record<string, string> = {
  BIG_LAVASH: "Large lavash with meat, vegetables, fries, and MAZETTO house sauce.",
  CLASSIC_LAVASH: "Classic MAZETTO lavash with meat, fresh vegetables, and house sauce.",
  MINI_LAVASH: "Compact lavash portion with classic filling.",
  BEEF_LAVASH: "Lavash with beef, vegetables, fries, and signature sauce.",
  CHICKEN_LAVASH: "Chicken lavash with fresh vegetables and MAZETTO sauce.",
  CHICKEN_CHEESE_LAVASH: "Chicken lavash with extra cheese and creamy sauce.",
  CHICKEN_SPICY_LAVASH: "Spicy chicken lavash with jalapeno and house sauce.",
  CLASSIC_BURGER: "Burger with beef patty, vegetables, cheese, and MAZETTO sauce.",
  BIG_BURGER: "Large beef burger with double filling and signature sauce.",
  CHEESEBURGER: "Beef burger with cheese, pickles, and sauce.",
  DOUBLE_BURGER: "Double patty burger with cheese and MAZETTO sauce.",
  CHICKEN_BURGER: "Chicken burger with crisp vegetables and house sauce.",
  CRISPY_CHICKEN_BURGER: "Crispy chicken fillet burger with creamy sauce.",
  CHICKEN_CHEESEBURGER: "Chicken burger with cheese and MAZETTO sauce.",
  CLASSIC_HOT_DOG: "Hot dog with sausage, vegetables, ketchup, and mayonnaise.",
  CHEESE_HOT_DOG: "Hot dog with cheese and sauce.",
  DOUBLE_HOT_DOG: "Loaded hot dog with double sausage.",
  DONER_WRAP: "Doner meat wrap with vegetables and sauce.",
  DONER_PLATE: "Doner meat plate with fries, salad, and sauce.",
  CHICKEN_DONER: "Chicken doner with fresh garnish and sauce.",
  FRIES: "Golden fried potato sticks.",
  CHEESE_FRIES: "French fries with cheese topping.",
  CHICKEN_STRIPS: "Crispy chicken strips with dip.",
  NUGGETS: "Chicken nuggets with sauce.",
  COCA_COLA: "Cold Coca-Cola drink.",
  FANTA: "Cold Fanta drink.",
  SPRITE: "Cold Sprite drink.",
  WATER: "Still bottled water.",
  HOUSE_SAUCE: "MAZETTO house sauce cup.",
  CHEESE_SAUCE: "Cheese sauce cup.",
  SPICY_SAUCE: "Spicy sauce cup.",
  FAMILY_SET: "Big Lavash, Classic Burger, French Fries, and two cold drinks.",
  LAVASH_SET: "Chicken Lavash with fries, sauce, and drink.",
  BURGER_SET: "Classic Burger with fries and drink.",
  KIDS_SET: "Nuggets with fries, cheese sauce, and water.",
};
