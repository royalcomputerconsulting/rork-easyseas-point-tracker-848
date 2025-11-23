import { Platform } from 'react-native';

export type ShipName = 'Harmony of the Seas' | 'Wonder of the Seas' | 'Star of the Seas' | 'Navigator of the Seas' | 'Ovation of the Seas' | 'Quantum of the Seas' | 'Radiance of the Seas' | string;

export interface RetailEstimateInput {
  ship: ShipName;
  nights: number;
  perNightPerPersonOverride?: number;
  pax?: number;
}

export interface RetailEstimate {
  retailCabinValue: number;
  taxesAndFees: number;
  gratuities: number;
}

const DEFAULT_PAX = 2 as const;

const PER_NIGHT_PPN: Record<string, number> = {
  // Oasis class
  'Harmony of the Seas': 430,
  'Wonder of the Seas': 450,
  'Star of the Seas': 470,
  // Voyager class
  'Navigator of the Seas': 360,
  // Quantum class
  'Quantum of the Seas': 390,
  'Ovation of the Seas': 390,
  // Radiance class
  'Radiance of the Seas': 320,
};

function getPerNightPPN(ship: ShipName, override?: number): number {
  if (override && override > 0) return override;
  const base = PER_NIGHT_PPN[ship] ?? 350;
  return base;
}

export function estimateRetail({ ship, nights, perNightPerPersonOverride, pax }: RetailEstimateInput): RetailEstimate {
  const safeNights = Math.max(1, Math.floor(nights));
  const passengers = Math.max(1, Math.floor(pax ?? DEFAULT_PAX));
  const ppn = getPerNightPPN(ship, perNightPerPersonOverride);

  const retailCabinValue = ppn * passengers * safeNights;

  const gratuityPerPersonPerNight = 16.0;
  const gratuities = gratuityPerPersonPerNight * passengers * safeNights;

  const basePortFees = 120;
  const perNightPortFeesPerPerson = 35;
  const taxesAndFees = basePortFees + perNightPortFeesPerPerson * passengers * safeNights;

  return {
    retailCabinValue: Math.round(retailCabinValue),
    taxesAndFees: Math.round(taxesAndFees),
    gratuities: Math.round(gratuities),
  };
}

export function explainEstimate(input: RetailEstimateInput): string {
  const pax = input.pax ?? DEFAULT_PAX;
  const ppn = getPerNightPPN(input.ship, input.perNightPerPersonOverride);
  return `ship=${input.ship}, nights=${input.nights}, pax=${pax}, ppn=${ppn} -> retail=${ppn*pax*input.nights}, taxes≈120+35*${pax}*${input.nights}, gratuities≈16*${pax}*${input.nights}`;
}
