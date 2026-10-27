import type { ImageKind, ProductStatus } from './constants.ts';

export interface Brand {
  id: string;
  slug: string;
  name: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
}

export interface ProductLine {
  id: string;
  slug: string;
  name: string;
  description: string;
  brandId: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  position: number;
  kind: ImageKind;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: Brand;
  category: Category;
  line: ProductLine | null;
  routineStep: number | null;
  summary: string;
  priceArs: number;
  volume: string;
  keyIngredients: string;
  benefits: string[];
  usageSteps: string[];
  skinTypes: string[];
  warnings: string;
  stock: number;
  status: ProductStatus;
  images: ProductImage[];
}

export interface CartLine {
  productId: string;
  quantity: number;
}

// Producto tal como lo necesita el carrito para validar y armar el mensaje
export interface CartProduct {
  id: string;
  name: string;
  brandName: string;
  priceArs: number;
  stock: number;
}
