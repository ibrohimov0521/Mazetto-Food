export type Branch = {
  id: string;
  code?: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  coordinates?: { latitude: number; longitude: number } | null;
  isOpen?: boolean;
  acceptsOrders?: boolean;
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
  temporarilyClosed?: boolean;
  workingHours?: {
    dayOfWeek: string;
    opensAt?: string | null;
    closesAt?: string | null;
    isClosed: boolean;
  }[];
};

export type Category = {
  id: string;
  code?: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
};

export type ProductVariant = {
  id: string;
  name: string;
  sellingPrice: string;
  isDefault: boolean;
};

export type ModifierLink = {
  modifier: {
    id: string;
    name: string;
    description?: string | null;
    price: string;
  };
};

export type Product = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  sellingPrice: string;
  preparationTime?: number | null;
  isRecommended?: boolean;
  isCombo?: boolean;
  category?: { id: string; code?: string; name: string } | null;
  variants: ProductVariant[];
  modifiers: ModifierLink[];
};

export type HomepageHeroSlide = {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  targetUrl?: string | null;
  badge?: string | null;
  sortOrder: number;
  product?: Pick<Product, "id" | "name" | "imageUrl" | "sellingPrice" | "preparationTime" | "isCombo"> | null;
};

export type HomepagePromotion = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  targetUrl?: string | null;
  badge?: string | null;
  discountPercent?: string | null;
  promotionalPrice?: string | null;
  sortOrder: number;
  product?: Pick<Product, "id" | "name" | "imageUrl" | "sellingPrice" | "preparationTime" | "isCombo"> | null;
  category?: Pick<Category, "id" | "name" | "imageUrl"> | null;
};

export type CustomerHome = {
  heroSlides: HomepageHeroSlide[];
  promotions: HomepagePromotion[];
};
