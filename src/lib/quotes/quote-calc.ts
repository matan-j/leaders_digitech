import { roundMoney } from './money';

export interface LineInput {
  meetings_count: number;
  hours_per_meeting: number;
  groups_count: number;
  hourly_rate_incl_vat: number;
}

export interface LineMath {
  total_hours: number;
  line_total_incl_vat: number;
}

export const calcLine = (line: LineInput): LineMath => {
  const meetings = Math.max(0, Number(line.meetings_count) || 0);
  const hours    = Math.max(0, Number(line.hours_per_meeting) || 0);
  const groups   = Math.max(0, Number(line.groups_count) || 0);
  const rate     = Math.max(0, Number(line.hourly_rate_incl_vat) || 0);

  const total_hours = roundMoney(meetings * hours * groups);
  const line_total_incl_vat = roundMoney(total_hours * rate);
  return { total_hours, line_total_incl_vat };
};

export interface QuoteTotalsInput {
  lines: Array<{ line_total_incl_vat: number }>;
  discount_amount: number;
  rounding_amount: number;
}

export interface QuoteTotals {
  subtotal_incl_vat: number;
  total_incl_vat: number;
}

export const calcQuoteTotals = (input: QuoteTotalsInput): QuoteTotals => {
  const subtotal_incl_vat = roundMoney(
    input.lines.reduce((sum, l) => sum + (Number(l.line_total_incl_vat) || 0), 0),
  );
  const discount = Math.max(0, Number(input.discount_amount) || 0);
  const rounding = Number(input.rounding_amount) || 0;
  const total_incl_vat = roundMoney(subtotal_incl_vat - discount + rounding);
  return { subtotal_incl_vat, total_incl_vat };
};
