// Money + VAT helpers — single source of truth for rounding & formatting.
// All quote-side prices in the system are VAT-inclusive by convention.

export const roundMoney = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

export const inclFromExcl = (excl: number, vatRate: number): number =>
  roundMoney(excl * (1 + vatRate / 100));

export const exclFromIncl = (incl: number, vatRate: number): number =>
  roundMoney(incl / (1 + vatRate / 100));

const ilsFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 2,
});

export const formatILS = (n: number): string => ilsFormatter.format(n ?? 0);

const numberFormatter = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 });

export const formatNumber = (n: number): string => numberFormatter.format(n ?? 0);
