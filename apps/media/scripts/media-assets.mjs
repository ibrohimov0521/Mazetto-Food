export const mediaRoot = "/media";

export const categoryAssets = [
  ["lavash.webp", "apps/customer-web/public/menu-media/source/categories/lavash.webp"],
  ["chicken-lavash.webp", "apps/customer-web/public/menu-media/source/categories/chicken-lavash.webp"],
  ["burger.webp", "apps/customer-web/public/menu-media/source/categories/burger.webp"],
  ["chicken-burger.webp", "apps/customer-web/public/menu-media/source/categories/chicken-burger.webp"],
  ["hot-dog.webp", "apps/customer-web/public/menu-media/source/categories/hot-dog.webp"],
  ["doner.webp", "apps/customer-web/public/menu-media/source/categories/doner.webp"],
  ["fast-food.webp", "apps/customer-web/public/menu-media/source/categories/fast-food.webp"],
  ["drinks.webp", "apps/customer-web/public/menu-media/source/categories/drinks.webp"],
  ["sauces.webp", "apps/customer-web/public/menu-media/source/categories/sauces.webp"],
  ["sets.webp", "apps/customer-web/public/menu-media/source/categories/sets.webp"],
].map(([filename, source]) => ({
  kind: "category",
  urlPath: `/categories/${filename}`,
  nginxPath: `${mediaRoot}/categories/${filename}`,
  source,
}));

export const productAssets = [
  ["lavash-big.webp", "apps/customer-web/public/menu-media/source/products/lavash-big.webp"],
  ["lavash-classic.webp", "apps/customer-web/public/menu-media/source/products/lavash-classic.webp"],
  ["lavash-mini.webp", "apps/customer-web/public/menu-media/source/products/lavash-mini.webp"],
  ["lavash-beef.webp", "apps/customer-web/public/menu-media/source/products/lavash-beef.webp"],
  ["chicken-lavash.webp", "apps/customer-web/public/menu-media/source/products/chicken-lavash.webp"],
  ["chicken-cheese-lavash.webp", "apps/customer-web/public/menu-media/source/products/chicken-cheese-lavash.webp"],
  ["chicken-spicy-lavash.webp", "apps/customer-web/public/menu-media/source/products/chicken-spicy-lavash.webp"],
  ["burger-classic.webp", "apps/customer-web/public/menu-media/source/products/burger-classic.webp"],
  ["burger-big.webp", "apps/customer-web/public/menu-media/source/products/burger-big.webp"],
  ["cheeseburger.webp", "apps/customer-web/public/menu-media/source/products/cheeseburger.webp"],
  ["burger-double.webp", "apps/customer-web/public/menu-media/source/products/burger-double.webp"],
  ["chicken-burger.webp", "apps/customer-web/public/menu-media/source/products/chicken-burger.webp"],
  ["crispy-chicken-burger.webp", "apps/customer-web/public/menu-media/source/products/crispy-chicken-burger.webp"],
  ["chicken-cheeseburger.webp", "apps/customer-web/public/menu-media/source/products/chicken-cheeseburger.webp"],
  ["hot-dog-classic.webp", "apps/customer-web/public/menu-media/source/products/hot-dog-classic.webp"],
  ["hot-dog-cheese.webp", "apps/customer-web/public/menu-media/source/products/hot-dog-cheese.webp"],
  ["hot-dog-double.webp", "apps/customer-web/public/menu-media/source/products/hot-dog-double.webp"],
  ["doner-wrap.webp", "apps/customer-web/public/menu-media/source/products/doner-wrap.webp"],
  ["doner-plate.webp", "apps/customer-web/public/menu-media/source/products/doner-plate.webp"],
  ["chicken-doner.webp", "apps/customer-web/public/menu-media/source/products/chicken-doner.webp"],
  ["fries.webp", "apps/customer-web/public/menu-media/source/products/fries.webp"],
  ["cheese-fries.webp", "apps/customer-web/public/menu-media/source/products/cheese-fries.webp"],
  ["nuggets.webp", "apps/customer-web/public/menu-media/source/products/nuggets.webp"],
  ["cheese-sauce.webp", "apps/customer-web/public/menu-media/source/products/cheese-sauce.webp"],
  ["set-family.webp", "apps/customer-web/public/menu-media/source/products/set-family.webp"],
  ["set-lavash.webp", "apps/customer-web/public/menu-media/source/products/set-lavash.webp"],
  ["set-burger.webp", "apps/customer-web/public/menu-media/source/products/set-burger.webp"],
].map(([filename, source]) => ({
  kind: "product",
  urlPath: `/products/${filename}`,
  nginxPath: `${mediaRoot}/products/${filename}`,
  source,
}));

export const unresolvedProductAssets = [
  "/products/chicken-strips.webp",
  "/products/coca-cola.webp",
  "/products/fanta.webp",
  "/products/sprite.webp",
  "/products/water.webp",
  "/products/house-sauce.webp",
  "/products/spicy-sauce.webp",
  "/products/set-kids.webp",
];

export const releaseAssets = [...categoryAssets, ...productAssets];
