import type { QuoteLine } from '@/types/quotes';
import { buildDescription } from './description-builder';

// Future Summit integration: transform an internal quote line into the
// reduced 4-column shape that Summit expects (product, description, qty, price).
// Pure transformation only — no HTTP, no side effects.
export interface SummitLine {
  external_product_name: string;
  external_description: string;
  external_quantity: number;
  external_price: number;
}

export const toSummitLine = (line: QuoteLine): SummitLine => ({
  external_product_name: line.product_name_snapshot,
  external_description: line.description_text?.trim()
    || buildDescription({
      grade_label: line.grade_label,
      class_label: line.class_label,
      meetings_count: line.meetings_count,
      groups_count: line.groups_count,
    }),
  external_quantity: line.total_hours,
  external_price: line.line_total_incl_vat,
});
