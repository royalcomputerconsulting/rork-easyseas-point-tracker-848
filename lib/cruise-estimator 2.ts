import React from 'react';
import { useFinancials } from '@/state/FinancialsProvider';

export type Confidence = 'Low' | 'Medium' | 'High';

export interface CruiseEstimateInput {
  nights: number;
  ship?: string;
  season?: 'Winter' | 'Spring' | 'Summer' | 'Fall';
}

export interface CruiseEstimate {
  expectedPoints: number;
  expectedCoinIn: number;
  confidence: Confidence;
  basedOnCruises: Array<{ cruiseId: string; ship: string; nights: number; points: number }>; 
  notes: string[];
}

function shipClassFactor(ship?: string): number {
  if (!ship) return 1;
  const s = ship.toLowerCase();
  if (/(icon|oasis|wonder|harmony|allure|symphony|utopia|star)/.test(s)) return 1.1;
  if (/(quantum|anthem|odyssey|ovation|spectrum)/.test(s)) return 1.05;
  if (/(voyager|navigator|mariner|explorer|adventure)/.test(s)) return 1.0;
  if (/(radiance|brilliance|jewel|serenade)/.test(s)) return 0.95;
  if (/(vision|rhapsody|enchantment|grandeur)/.test(s)) return 0.9;
  return 1.0;
}

function seasonFactor(season?: CruiseEstimateInput['season']): number {
  switch (season) {
    case 'Summer':
      return 1.05;
    case 'Winter':
      return 0.95;
    case 'Spring':
    case 'Fall':
      return 1.0;
    default:
      return 1.0;
  }
}

export function useCruiseEstimator() {
  const { getAllSummaries } = useFinancials();

  const estimateCruise = React.useCallback((input: CruiseEstimateInput): CruiseEstimate => {
    const nights = Math.max(1, Math.floor(input.nights || 1));
    const history = getAllSummaries();

    const basePointsPerNight = (() => {
      if (!history || history.length === 0) return 204.25;
      const recent = history.slice(-7);
      const totalPts = recent.reduce((s, c) => s + (c.pointsEarned || 0), 0);
      const totalNights = recent.reduce((s, c) => {
        const d1 = new Date(c.date).getTime();
        const d2 = d1 + 24 * 60 * 60 * 1000; // assume at least 1 night if unknown
        const n = Math.max(1, Math.round((d2 - d1) / (24 * 60 * 60 * 1000)));
        return s + n;
      }, 0);
      const denom = totalNights > 0 ? totalNights : recent.length;
      return denom > 0 ? totalPts / denom : 204.25;
    })();

    const factors: number[] = [];
    const notes: string[] = [];

    const shipF = shipClassFactor(input.ship);
    factors.push(shipF);
    if (input.ship) notes.push(`Ship factor (${input.ship}): x${shipF.toFixed(2)}`);

    const seasonF = seasonFactor(input.season);
    factors.push(seasonF);
    if (input.season) notes.push(`Season factor (${input.season}): x${seasonF.toFixed(2)}`);

    const durationF = nights >= 7 ? 1.05 : nights <= 3 ? 0.9 : 1.0;
    factors.push(durationF);
    notes.push(`Duration factor (${nights} nights): x${durationF.toFixed(2)}`);

    const multiplier = factors.reduce((a, b) => a * b, 1);
    const expectedPoints = Math.round(basePointsPerNight * nights * multiplier);

    const expectedCoinIn = Math.round(expectedPoints * 5); // using 1 point per $5 coin-in

    const basedOnCruises = (history.slice(-7) || []).map(c => ({
      cruiseId: c.cruiseId,
      ship: c.ship,
      nights: 1, // unknown; not tracked precisely here
      points: c.pointsEarned,
    }));

    const confidence: Confidence = history.length >= 5 ? (history.length >= 7 ? 'High' as const : 'Medium' as const) : 'Low';

    return {
      expectedPoints,
      expectedCoinIn,
      confidence,
      basedOnCruises,
      notes,
    };
  }, [getAllSummaries]);

  return { estimateCruise };
}
