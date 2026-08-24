export type Branch = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
};

export type Category = {
  id: string;
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
  category?: { id: string; name: string } | null;
  variants: ProductVariant[];
  modifiers: ModifierLink[];
};
