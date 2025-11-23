import { useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { CRUISE_DATA, POINTS_DATA, TOTALS, CruiseData, PointsData } from '@/constants/cruiseData';

interface AnalyticsData {
  cruises: CruiseData[];
  points: PointsData[];
  totals: typeof TOTALS;
  calculations: {
    totalROI: number;
    avgPointsPerCruise: number;
    avgWinningsPerCruise: number;
    totalValueReceived: number;
    totalOutOfPocket: number;
    valuePerPoint: number;
  };
  rankings: {
    bestROI: { cruise: CruiseData; roi: number }[];
    mostPoints: { cruise: CruiseData; points: number }[];
    biggestWins: { cruise: CruiseData; winnings: number }[];
    highestCredits: { cruise: CruiseData; credits: number }[];
  };
}

export const [AnalyticsProvider, useAnalytics] = createContextHook(() => {
  const data = useMemo((): AnalyticsData => {
    // Match cruise data with points data
    const enrichedCruises = CRUISE_DATA.map(cruise => {
      const pointsEntry = POINTS_DATA.find(p => 
        p.ship.toLowerCase().includes(cruise.ship.toLowerCase().split(' ')[0]) ||
        cruise.ship.toLowerCase().includes(p.ship.toLowerCase())
      );
      return {
        ...cruise,
        points: pointsEntry?.points || Math.round(cruise.gaming / 5),
        winnings: pointsEntry?.winnings || 0
      };
    });

    // Calculate metrics
    const totalOutOfPocket = enrichedCruises.reduce((sum, c) => sum + Math.abs(c.payment), 0);
    const totalValueReceived = TOTALS.totalCredits;
    const totalROI = totalOutOfPocket > 0 ? ((totalValueReceived - totalOutOfPocket) / totalOutOfPocket) * 100 : 0;
    const avgPointsPerCruise = TOTALS.totalPoints / TOTALS.totalCruises;
    const avgWinningsPerCruise = TOTALS.totalWinnings / TOTALS.totalCruises;
    const valuePerPoint = TOTALS.totalPoints > 0 ? (totalValueReceived - totalOutOfPocket) / TOTALS.totalPoints : 0;

    // Create rankings
    const bestROI = enrichedCruises
      .map(cruise => ({
        cruise,
        roi: Math.abs(cruise.payment) > 0 ? ((cruise.credits - Math.abs(cruise.payment)) / Math.abs(cruise.payment)) * 100 : 0
      }))
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 10);

    const mostPoints = enrichedCruises
      .map(cruise => ({ cruise, points: cruise.points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    const biggestWins = enrichedCruises
      .map(cruise => ({ cruise, winnings: cruise.winnings }))
      .sort((a, b) => b.winnings - a.winnings)
      .slice(0, 10);

    const highestCredits = enrichedCruises
      .map(cruise => ({ cruise, credits: cruise.credits }))
      .sort((a, b) => b.credits - a.credits)
      .slice(0, 10);

    return {
      cruises: enrichedCruises,
      points: POINTS_DATA,
      totals: TOTALS,
      calculations: {
        totalROI,
        avgPointsPerCruise,
        avgWinningsPerCruise,
        totalValueReceived,
        totalOutOfPocket,
        valuePerPoint
      },
      rankings: {
        bestROI,
        mostPoints,
        biggestWins,
        highestCredits
      }
    };
  }, []);

  return data;
});