export type ProductStatus = 'active' | 'inactive';

export interface Product {
  id: string;
  name: string;
  short_description: string | null;
  price_excl_vat: number;
  vat_rate: number;
  price_incl_vat: number;
  website_url: string | null;
  syllabus_url: string | null;
  sort_order: number;
  internal_notes: string | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export type ProductInput = Pick<
  Product,
  | 'name'
  | 'short_description'
  | 'vat_rate'
  | 'price_incl_vat'
  | 'price_excl_vat'
  | 'website_url'
  | 'syllabus_url'
  | 'sort_order'
  | 'internal_notes'
  | 'status'
>;
