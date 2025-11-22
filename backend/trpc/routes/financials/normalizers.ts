import type { FinancialsRecord } from '@/types/models';

export type PaymentMethod = 'SeaPass' | 'OBC' | 'Credit Card' | 'Promo';
export type Department = 'Casino' | 'Beverage' | 'Dining' | 'Photo' | 'Spa' | 'Retail' | 'ShoreEx' | 'ServiceFees' | 'Taxes' | 'Gratuities' | 'Other';
export type Category = 'Food & Beverage' | 'Retail' | 'Spa' | 'ShoreEx' | 'Casino' | 'Gratuity' | 'Tax/Fees' | 'Other';

export function normalizePaymentMethod(input?: string | null): PaymentMethod | undefined {
  if (!input) return undefined;
  const s = input.trim().toLowerCase();
  if (/(sea\s?pass|onboard\s?account|seapass)/.test(s)) return 'SeaPass';
  if (/(on.?board\s?credit|obc|non-?refundable.*credit)/.test(s)) return 'OBC';
  if (/(visa|master|amex|credit|card|discover)/.test(s)) return 'Credit Card';
  if (/(promo|certificate|voucher|next\s?cruise|casino\s?comp)/.test(s)) return 'Promo';
  return undefined;
}

export function normalizeDepartment(input?: string | null): Department | undefined {
  if (!input) return undefined;
  const s = input.trim().toLowerCase();
  if (/casino|gaming|club\s?royale/.test(s)) return 'Casino';
  if (/beverage|bar|cafe|starbucks|coconut/.test(s)) return 'Beverage';
  if (/dining|restaurant|izumi|hooked|chef/.test(s)) return 'Dining';
  if (/photo/.test(s)) return 'Photo';
  if (/spa|salon|vitality/.test(s)) return 'Spa';
  if (/retail|shop|solera|duty/.test(s)) return 'Retail';
  if (/shore.*ex|excursion/.test(s)) return 'ShoreEx';
  if (/service.*fee|wow.?band/.test(s)) return 'ServiceFees';
  if (/tax/.test(s)) return 'Taxes';
  if (/gratu/i.test(s)) return 'Gratuities';
  return 'Other';
}

export function normalizeCategory(input?: string | null): Category | undefined {
  if (!input) return undefined;
  const s = input.trim().toLowerCase();
  if (/casino|gaming|club\s?royale/.test(s)) return 'Casino';
  if (/food|dining|restaurant|chef|izumi|hooked/.test(s)) return 'Food & Beverage';
  if (/beverage|bar|cafe|coffee|drink/.test(s)) return 'Food & Beverage';
  if (/spa|salon|vitality/.test(s)) return 'Spa';
  if (/retail|shop|duty|photo/.test(s)) return 'Retail';
  if (/shore.*ex|excursion/.test(s)) return 'ShoreEx';
  if (/gratu/i.test(s)) return 'Gratuity';
  if (/tax|fee/.test(s)) return 'Tax/Fees';
  return 'Other';
}

export function extractOnboardCredit(description?: string | null, amount?: number | null): number | undefined {
  if (!description) return undefined;
  const s = description.toLowerCase();
  if (/on.?board\s?credit|obc/.test(s)) {
    const val = typeof amount === 'number' ? Math.abs(amount) : undefined;
    return val;
  }
  return undefined;
}

export function extractRefOrFolio(description?: string | null): { refNumber?: string; folioNumber?: string } {
  if (!description) return {};
  const refMatch = description.match(/ref\s?#?([A-Z0-9\-]+)/i);
  const folioMatch = description.match(/folio\s?#?([A-Z0-9\-]+)/i);
  return {
    refNumber: refMatch ? refMatch[1] : undefined,
    folioNumber: folioMatch ? folioMatch[1] : undefined,
  };
}

export function computeMixedCurrency(records: Pick<FinancialsRecord, 'currency'>[]): boolean {
  const set = new Set<string>();
  for (const r of records) {
    if ((r as any).currency && (r as any).currency.trim() !== '') set.add((r as any).currency.trim());
  }
  return set.size > 1;
}
