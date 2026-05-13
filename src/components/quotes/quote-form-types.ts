import type { QuoteStatus } from '@/types/quotes';

export interface QuoteLineFormValue {
  // null when the line is brand-new (not yet persisted) or when product was deleted
  id: string | null;
  product_id: string | null;
  product_name_snapshot: string;
  grade_label: string;
  class_label: string;
  description_text: string;
  // tracks whether the user manually edited description_text (suppresses auto-build)
  description_dirty: boolean;
  meetings_count: number;
  hours_per_meeting: number;
  groups_count: number;
  total_hours: number;          // computed
  hourly_rate_incl_vat: number;
  line_total_incl_vat: number;  // computed
  internal_notes: string;
}

export interface QuoteFormValues {
  // header
  quote_number: string;          // read-only display
  issue_date: string;            // yyyy-mm-dd
  valid_until: string;           // yyyy-mm-dd or ""
  status: QuoteStatus;

  // customer snapshot (read-only display)
  customer_snapshot_name: string;
  contact_snapshot_name: string;
  contact_snapshot_phone: string;
  contact_snapshot_email: string;

  // body
  lines: QuoteLineFormValue[];

  // footer
  discount_amount: number;
  rounding_amount: number;
  notes: string;
  terms_text: string;
}
