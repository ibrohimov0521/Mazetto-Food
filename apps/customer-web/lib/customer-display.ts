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

const categoryLabelsRu: Record<string, string> = {
  "LAVASH": "Лаваши",
  "CHICKEN_LAVASH": "Лаваш с курицей",
  "BURGER": "Бургеры",
  "CHICKEN_BURGER": "Бургеры с курицей",
  "HOT_DOG": "Хот-доги",
  "DONER": "Донер, клаб-сэндвичи и хагги",
  "BLYUDALAR": "Блюда",
  "FAST_FOOD": "Закуски",
  "DRINKS": "Напитки",
  "SAUCES": "Соусы",
  "SETS": "Наборы"
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

const productLabelsRu: Record<string, string> = {
  "BIG_LAVASH": "Большой лаваш",
  "CLASSIC_LAVASH": "Классический лаваш",
  "MINI_LAVASH": "Мини-лаваш",
  "BEEF_LAVASH": "Лаваш с говядиной",
  "CHICKEN_LAVASH": "Лаваш с курицей",
  "CHICKEN_CHEESE_LAVASH": "Лаваш с курицей и сыром",
  "CHICKEN_SPICY_LAVASH": "Острый лаваш с курицей",
  "CLASSIC_BURGER": "Классический бургер",
  "BIG_BURGER": "Большой бургер",
  "CHEESEBURGER": "Чизбургер",
  "DOUBLE_BURGER": "Двойной бургер",
  "CHICKEN_BURGER": "Бургер с курицей",
  "CRISPY_CHICKEN_BURGER": "Бургер с хрустящей курицей",
  "CHICKEN_CHEESEBURGER": "Чизбургер с курицей",
  "CLASSIC_HOT_DOG": "Классический хот-дог",
  "CHEESE_HOT_DOG": "Хот-дог с сыром",
  "DOUBLE_HOT_DOG": "Двойной хот-дог",
  "DONER_WRAP": "Донер-лаваш",
  "DONER_PLATE": "Донер на тарелке",
  "CHICKEN_DONER": "Донер с курицей",
  "FRIES": "Картофель фри",
  "CHEESE_FRIES": "Фри с сыром",
  "CHICKEN_STRIPS": "Куриные стрипсы",
  "NUGGETS": "Наггетсы",
  "COCA_COLA": "Coca-Cola",
  "FANTA": "Fanta",
  "SPRITE": "Sprite",
  "WATER": "Вода",
  "HOUSE_SAUCE": "Фирменный соус",
  "CHEESE_SAUCE": "Сырный соус",
  "SPICY_SAUCE": "Острый соус",
  "FAMILY_SET": "Семейный набор",
  "LAVASH_SET": "Набор с лавашом",
  "BURGER_SET": "Набор с бургером",
  "KIDS_SET": "Детский набор"
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

const variantLabelsRu: Record<string, string> = {
  STANDARD: "Стандартный",
  CHEESE: "С сыром",
  SPICY: "Острый",
  DOUBLE_CHEESE: "Двойной сыр",
  "500ML": "500 мл",
  "1L": "1 л",
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

const modifierLabelsRu: Record<string, string> = {
  EXTRA_CHEESE: "Дополнительный сыр",
  EXTRA_SAUCE: "Дополнительный соус",
  SPICY: "Острый",
  NO_ONION: "Без лука",
  NO_CUCUMBER: "Без огурца",
  ADDITIONAL_MEAT: "Дополнительное мясо",
  BBQ_SAUCE: "Соус BBQ",
  JALAPENO: "Халапеньо",
};

export function displayCategory(category: Category, locale = "uz"): Category {
  const nextCategory: Category = {
    ...category,
    name: category.code ? (locale === "ru" ? categoryLabelsRu[category.code] : categoryLabels[category.code]) ?? category.name : category.name,
  };

  if (category.description != null) {
    nextCategory.description = localizeCategoryDescription(category, locale) ?? category.description;
  }

  return nextCategory;
}

export function displayProduct(product: Product, locale = "uz"): Product {
  const nextProduct: Product = {
    ...product,
    modifiers: product.modifiers.map((link) => displayModifierLink(link, locale)),
    name: displayKnownTitle(product.name, locale),
    variants: product.variants.map((variant) => displayVariant(variant, locale)),
  };

  if (product.category !== undefined) {
    nextProduct.category = product.category ? displayProductCategory(product.category, locale) : product.category;
  }

  if (product.description != null) {
    nextProduct.description = displayKnownDescription(product.description, locale) ?? product.description;
  }

  return nextProduct;
}

export function displayProducts(products: Product[], locale = "uz"): Product[] {
  return products.map((product) => displayProduct(product, locale));
}

export function displayCustomerHome(home: CustomerHome, locale = "uz"): CustomerHome {
  return {
    heroSlides: home.heroSlides.map((slide) => displayHeroSlide(slide, locale)),
    promotions: home.promotions.map((promotion) => displayPromotion(promotion, locale)),
  };
}

export function localizeMenuName(value: string | null | undefined, locale = "uz"): string {
  return value ? displayKnownTitle(value, locale) : "";
}

export function localizeMenuDescription(value: string | null | undefined): string | null | undefined {
  return value ? displayKnownDescription(value) : value;
}

export function displayVariant(variant: ProductVariant, locale = "uz"): ProductVariant {
  const labels = locale === "ru" ? variantLabelsRu : variantLabels;
  return { ...variant, name: labels[variant.code ?? variant.name.toUpperCase()] ?? displayKnownTitle(variant.name, locale) };
}

export function displayModifierLink(link: ModifierLink, locale = "uz"): ModifierLink {
  const labels = locale === "ru" ? modifierLabelsRu : modifierLabels;
  return {
    ...link,
    modifier: {
      ...link.modifier,
      name: link.modifier.code ? labels[link.modifier.code] ?? displayKnownTitle(link.modifier.name, locale) : displayKnownTitle(link.modifier.name, locale),
    },
  };
}

function displayProductCategory(category: NonNullable<Product["category"]>, locale: string): NonNullable<Product["category"]> {
  return {
    ...category,
    name: category.code ? (locale === "ru" ? categoryLabelsRu[category.code] : categoryLabels[category.code]) ?? category.name : category.name,
  };
}

function displayHeroSlide(slide: HomepageHeroSlide, locale: string): HomepageHeroSlide {
  const product = slide.product ? displayProductSummary(slide.product, locale) : slide.product;

  const nextSlide: HomepageHeroSlide = {
    ...slide,
    title: displayKnownTitle(slide.title, locale),
  };

  if (product !== undefined) {
    nextSlide.product = product;
  }

  if (slide.subtitle != null || product?.name) {
    nextSlide.subtitle = slide.subtitle ?? product?.name ?? null;
  }

  return nextSlide;
}

function displayPromotion(promotion: HomepagePromotion, locale: string): HomepagePromotion {
  const product = promotion.product ? displayProductSummary(promotion.product, locale) : promotion.product;

  const nextPromotion: HomepagePromotion = {
    ...promotion,
    title: displayKnownTitle(promotion.title, locale),
  };

  if (promotion.category !== undefined) {
    nextPromotion.category = promotion.category
      ? {
          ...promotion.category,
          name: displayKnownTitle(promotion.category.name, locale),
        }
      : promotion.category;
  }

  if (promotion.description != null) {
    nextPromotion.description = displayKnownDescription(promotion.description, locale) ?? promotion.description;
  }

  if (product !== undefined) {
    nextPromotion.product = product;
  }

  return nextPromotion;
}

function displayProductSummary<T extends Pick<Product, "id" | "name" | "imageUrl" | "sellingPrice" | "preparationTime" | "isCombo">>(product: T, locale: string): T {
  return {
    ...product,
    name: displayKnownTitle(product.name, locale),
  };
}

function displayKnownTitle(value: string, locale = "uz"): string {
  const productLabelsForLocale = locale === "ru" ? productLabelsRu : productLabels;
  const productCode = Object.keys(productLabels).find(
    (code) => productLabels[code] === value || productLabelsRu[code] === value || seedProductNames[code] === value,
  );
  if (productCode) return productLabelsForLocale[productCode] ?? productLabels[productCode] ?? value;

  const variantCode = Object.keys(variantLabels).find((code) => variantLabels[code] === value || variantLabelsRu[code] === value);
  if (variantCode) return (locale === "ru" ? variantLabelsRu : variantLabels)[variantCode] ?? value;

  const modifierCode = Object.keys(modifierLabels).find((code) => modifierLabels[code] === value || modifierLabelsRu[code] === value);
  if (modifierCode) return (locale === "ru" ? modifierLabelsRu : modifierLabels)[modifierCode] ?? value;

  return value;
}

const productDescriptionsRu: Record<string, string> = {
  BIG_LAVASH: "Большой лаваш с мясом, овощами, картофелем фри и фирменным соусом MAZETTO.",
  CLASSIC_LAVASH: "Классический лаваш с мясом, свежими овощами и фирменным соусом.",
  MINI_LAVASH: "Небольшая порция классического лаваша.",
  BEEF_LAVASH: "Лаваш с говядиной, овощами, картофелем фри и фирменным соусом.",
  CHICKEN_LAVASH: "Лаваш с курицей, свежими овощами и соусом MAZETTO.",
  CHICKEN_CHEESE_LAVASH: "Лаваш с курицей, сыром и сливочным соусом.",
  CHICKEN_SPICY_LAVASH: "Острый лаваш с курицей, халапеньо и фирменным соусом.",
  CLASSIC_BURGER: "Бургер с говяжьей котлетой, овощами, сыром и соусом MAZETTO.",
  BIG_BURGER: "Большой сытный бургер с двойной порцией говядины.",
  CHEESEBURGER: "Бургер с говядиной, сыром, маринованными огурцами и соусом.",
  DOUBLE_BURGER: "Бургер с двумя котлетами, сыром и соусом MAZETTO.",
  CHICKEN_BURGER: "Бургер с курицей, овощами и фирменным соусом.",
  CRISPY_CHICKEN_BURGER: "Бургер с хрустящим куриным филе и сливочным соусом.",
  CHICKEN_CHEESEBURGER: "Бургер с курицей, сыром и соусом MAZETTO.",
  CLASSIC_HOT_DOG: "Хот-дог с сосиской, овощами, кетчупом и майонезом.",
  CHEESE_HOT_DOG: "Хот-дог с сыром и соусом.",
  DOUBLE_HOT_DOG: "Сытный хот-дог с двумя сосисками.",
  DONER_WRAP: "Ролл с мясом донера, овощами и соусом.",
  DONER_PLATE: "Мясо донера с картофелем фри, салатом и соусом.",
  CHICKEN_DONER: "Донер с курицей, гарниром и соусом.",
  FRIES: "Хрустящий картофель фри.",
  CHEESE_FRIES: "Картофель фри с сырным соусом.",
  CHICKEN_STRIPS: "Хрустящие куриные стрипсы с соусом.",
  NUGGETS: "Куриные наггетсы с соусом.",
  COCA_COLA: "Охлаждённая Coca-Cola.",
  FANTA: "Охлаждённая Fanta.",
  SPRITE: "Охлаждённый Sprite.",
  WATER: "Питьевая негазированная вода.",
  HOUSE_SAUCE: "Фирменный соус MAZETTO.",
  CHEESE_SAUCE: "Сырный соус.",
  SPICY_SAUCE: "Острый соус.",
  FAMILY_SET: "Большой лаваш, классический бургер, картофель фри и два напитка.",
  LAVASH_SET: "Лаваш с курицей, картофель фри, соус и напиток.",
  BURGER_SET: "Классический бургер, картофель фри и напиток.",
  KIDS_SET: "Наггетсы, картофель фри, сырный соус и вода.",
};

function displayKnownDescription(value: string, locale = "uz"): string | undefined {
  const match = Object.entries(seedProductDescriptions).find(([, seedDescription]) => seedDescription === value);
  return match ? (locale === "ru" ? productDescriptionsRu[match[0]] : productDescriptions[match[0]]) : undefined;
}

function localizeCategoryDescription(category: Category, locale: string): string | null | undefined {
  const descriptions: Record<string, string> = locale === "ru" ? {
    LAVASH: "Лаваши с говядиной, курицей, сыром, острые и тандырные.", CHICKEN_LAVASH: "Раздел лавашей с курицей.", BURGER: "Бургеры с говядиной и курицей.", CHICKEN_BURGER: "Раздел бургеров с курицей.", HOT_DOG: "Хот-доги с салатом, колбасой, курицей и шашлыком.", DONER: "Донер, клаб-сэндвичи, хагги и блюда в домашнем стиле.", BLYUDALAR: "Блюда на тарелке и в домашнем стиле.", FAST_FOOD: "Картофель фри, наггетсы, куриные шарики и другие закуски.", DRINKS: "Прохладительные напитки к блюдам и наборам.", SAUCES: "Соусы и добавки.", SETS: "Выгодные наборы и семейные комплекты."
  } : {
    LAVASH: "Mol go'shtli, tovuqli, pishloqli, achchiq va tandir lavashlar.",
    CHICKEN_LAVASH: "Legacy tovuqli lavash bo'limi.",
    BURGER: "Mol go'shtli va tovuqli burgerlar.",
    CHICKEN_BURGER: "Legacy tovuqli burger bo'limi.",
    HOT_DOG: "Salatli, qazili, chicken va shashlikli hot doglar.",
    DONER: "Doner, klab senvich, xaggi va uy uslubidagi mahsulotlar.",
    BLYUDALAR: "Tarelka va uy uslubidagi blyudalar.",
    FAST_FOOD: "Fri, naggets, kurinniy sharik va boshqa gazaklar.",
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

// The homepage renders at most four recommended, four combo and six popular
// products, so both the server payload and the client refresh carry only those.
export function selectHomeProducts(products: Product[], home: CustomerHome): Product[] {
  const keep = new Set<string>();
  for (const product of products.filter((product) => product.isRecommended).slice(0, 4)) keep.add(product.id);
  for (const product of products.filter((product) => product.isCombo).slice(0, 4)) keep.add(product.id);
  for (const product of products.filter((product) => !product.isCombo).slice(0, 6)) keep.add(product.id);
  for (const slide of home.heroSlides) if (slide.product?.id) keep.add(slide.product.id);

  return products.filter((product) => keep.has(product.id));
}
