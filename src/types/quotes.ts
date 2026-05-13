export type QuoteStatus = 'draft' | 'ready' | 'sent' | 'approved' | 'cancelled';
export type SummitExportStatus = 'pending' | 'exported' | 'failed';

export interface Quote {
  id: string;
  institution_id: string;
  quote_number: string;
  issue_date: string;
  valid_until: string | null;
  status: QuoteStatus;

  customer_snapshot_name: string;
  contact_snapshot_name: string | null;
  contact_snapshot_phone: string | null;
  contact_snapshot_email: string | null;

  subtotal_incl_vat: number;
  discount_amount: number;
  rounding_amount: number;
  total_incl_vat: number;

  notes: string | null;
  terms_text: string | null;

  summit_export_status: SummitExportStatus | null;
  summit_export_reference: string | null;

  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface QuoteLine {
  id: string;
  quote_id: string;
  product_id: string | null;

  product_name_snapshot: string;

  grade_label: string | null;
  class_label: string | null;
  description_text: string | null;

  meetings_count: number;
  hours_per_meeting: number;
  groups_count: number;
  total_hours: number;

  hourly_rate_incl_vat: number;
  line_total_incl_vat: number;

  internal_notes: string | null;

  external_product_name: string | null;
  external_description: string | null;
  external_quantity: number | null;
  external_price: number | null;

  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface QuoteWithLines {
  quote: Quote;
  lines: QuoteLine[];
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'טיוטה',
  ready: 'מוכן',
  sent: 'נשלח',
  approved: 'אושר',
  cancelled: 'בוטל',
};
