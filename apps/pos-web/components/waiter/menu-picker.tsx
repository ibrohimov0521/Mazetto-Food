"use client";

import { Plus, Search, X } from "lucide-react";
import { StaffEmpty } from "../staff/staff-shell";
import styles from "../staff/staff.module.css";
import { handleProductImageError, productImage } from "../../lib/media";
import { formatMoney } from "../../lib/order-display";
import {
  productBasePrice,
  type MenuCategory,
  type MenuProduct,
} from "./waiter-model";

export function MenuPicker({
  categories,
  products,
  query,
  categoryId,
  disabled,
  onQueryChange,
  onCategoryChange,
  onSelect,
}: {
  categories: MenuCategory[];
  products: MenuProduct[];
  query: string;
  categoryId: string;
  disabled: boolean;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSelect: (product: MenuProduct) => void;
}) {
  return (
    <div>
      <div className={styles.catalogBar}>
        <label className={styles.search}>
          <Search size={19} aria-hidden="true" />
          <input
            placeholder="Mahsulot qidirish..."
            aria-label="Mahsulot qidirish"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label="Qidiruvni tozalash"
              title="Qidiruvni tozalash"
              onClick={() => onQueryChange("")}
            >
              <X size={18} />
            </button>
          )}
        </label>
        <span className={styles.waiterCount}>
          {products.length} ta mahsulot
        </span>
      </div>

      <nav className={styles.categoryNav} aria-label="Mahsulot kategoriyalari">
        <button
          aria-pressed={categoryId === "ALL"}
          onClick={() => onCategoryChange("ALL")}
          type="button"
        >
          Barchasi
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            aria-pressed={categoryId === category.id}
            onClick={() => onCategoryChange(category.id)}
            type="button"
          >
            {category.name}
          </button>
        ))}
      </nav>

      {products.length ? (
        <div className={styles.productGrid}>
          {products.map((product) => (
            <button
              className={styles.product}
              key={product.id}
              disabled={disabled}
              aria-label={`${product.name}, ${formatMoney(productBasePrice(product))}, buyurtmaga qo'shish`}
              onClick={() => onSelect(product)}
              type="button"
            >
              <span className={styles.productImage}>
                <img
                  src={productImage(product.imageUrl)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={(event) =>
                    handleProductImageError(event.currentTarget)
                  }
                />
                <span className={styles.productAdd}>
                  <Plus size={20} aria-hidden="true" />
                </span>
              </span>
              <span className={styles.productInfo}>
                <span className={styles.waiterProductName}>{product.name}</span>
                <span className={styles.waiterProductPrice}>
                  {formatMoney(productBasePrice(product))}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <StaffEmpty title="Mahsulot topilmadi">
          Qidiruv yoki kategoriyani o&apos;zgartiring.
        </StaffEmpty>
      )}
    </div>
  );
}
