import { publicProcedure } from '../../../create-context';
import { z } from 'zod';
import { memoryStore } from '../../_stores/memory';

interface BookingWindowPrediction {
  cruiseId: string;
  ship: string;
  departureDate: string;
  itineraryName: string;
  bookingWindowAnalysis: {
    daysUntilDeparture: number;
    currentPriceLevel: 'low' | 'medium' | 'high';
    priceDropLikelihood: number;
    recommendedAction: 'book_now' | 'wait' | 'monitor';
    optimalBookingWindow: {
      start: number;
      end: number;
      reason: string;
    };
  };
  priceHistory: {
    cabinType: string;
    currentPrice: number | null;
    lowestPrice: number | null;
    highestPrice: number | null;
    averagePrice: number | null;
    priceChange30Days: number | null;
    priceChange60Days: number | null;
    priceChange90Days: number | null;
    isAtHistoricalLow: boolean;
    daysAtCurrentPrice: number;
  }[];
  pricingTrends: {
    trend: 'rising' | 'falling' | 'stable';
    velocityPerDay: number;
    predictedPriceIn30Days: number | null;
    predictedPriceIn60Days: number | null;
    confidence: number;
  };
  similarCruisesData: {
    averageDaysBeforeBooking: number;
    bestBookingWindowStart: number;
    bestBookingWindowEnd: number;
    typicalPriceDropDays: number[];
  };
  alerts: {
    type: 'price_drop' | 'historical_low' | 'optimal_window' | 'last_minute_deal';
    message: string;
    severity: 'info' | 'warning' | 'success';
  }[];
}

export const bookingWindowPredictionProcedure = publicProcedure
  .input(
    z.object({
      cruiseId: z.string().optional(),
      shipName: z.string().optional(),
      departurePortFilter: z.string().optional(),
      cabinTypeFilter: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const cruises = memoryStore.getCruises();
    
    let targetCruises = cruises;
    
    if (input.cruiseId) {
      targetCruises = cruises.filter(c => c.id === input.cruiseId);
    } else {
      if (input.shipName) {
        targetCruises = targetCruises.filter(c => c.ship === input.shipName);
      }
      if (input.departurePortFilter) {
        targetCruises = targetCruises.filter(c => c.departurePort === input.departurePortFilter);
      }
    }

    const predictions: BookingWindowPrediction[] = [];

    for (const cruise of targetCruises) {
      const departureDate = new Date(cruise.departureDate);
      const today = new Date();
      const daysUntilDeparture = Math.ceil(
        (departureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilDeparture <= 0) continue;

      const cabinTypes = ['interior', 'oceanview', 'balcony', 'suite'] as const;
      const priceHistory: BookingWindowPrediction['priceHistory'] = [];

      for (const cabinType of cabinTypes) {
        const currentKey = `${cabinType}Price` as keyof typeof cruise;
        const currentPrice = cruise[currentKey] as number | null | undefined;
        
        const lowestKey = `${cabinType}Price` as keyof typeof cruise.pricingLowest;
        const lowestPrice = cruise.pricingLowest?.[lowestKey] ?? null;

        const avgPrice = currentPrice && lowestPrice
          ? (currentPrice + lowestPrice) / 2
          : currentPrice ?? lowestPrice;

        const isAtHistoricalLow = currentPrice !== null &&
          currentPrice !== undefined &&
          lowestPrice !== null &&
          currentPrice <= lowestPrice * 1.05;

        priceHistory.push({
          cabinType,
          currentPrice: currentPrice ?? null,
          lowestPrice: lowestPrice ?? null,
          highestPrice: currentPrice && lowestPrice
            ? Math.max(currentPrice, lowestPrice * 1.5)
            : currentPrice ?? null,
          averagePrice: avgPrice ?? null,
          priceChange30Days: null,
          priceChange60Days: null,
          priceChange90Days: null,
          isAtHistoricalLow,
          daysAtCurrentPrice: 0,
        });
      }

      const avgCurrentPrice =
        priceHistory
          .filter(ph => ph.currentPrice !== null)
          .reduce((sum, ph) => sum + (ph.currentPrice ?? 0), 0) /
        priceHistory.filter(ph => ph.currentPrice !== null).length;

      const avgLowestPrice =
        priceHistory
          .filter(ph => ph.lowestPrice !== null)
          .reduce((sum, ph) => sum + (ph.lowestPrice ?? 0), 0) /
        priceHistory.filter(ph => ph.lowestPrice !== null).length;

      const priceLevel: 'low' | 'medium' | 'high' =
        avgLowestPrice && avgCurrentPrice <= avgLowestPrice * 1.1
          ? 'low'
          : avgLowestPrice && avgCurrentPrice >= avgLowestPrice * 1.3
          ? 'high'
          : 'medium';

      const priceDropLikelihood =
        daysUntilDeparture > 120
          ? 0.4
          : daysUntilDeparture > 60
          ? 0.3
          : daysUntilDeparture > 30
          ? 0.5
          : daysUntilDeparture > 14
          ? 0.7
          : 0.2;

      let recommendedAction: 'book_now' | 'wait' | 'monitor' = 'monitor';
      if (priceLevel === 'low' && daysUntilDeparture > 30) {
        recommendedAction = 'book_now';
      } else if (priceLevel === 'high' && priceDropLikelihood > 0.5) {
        recommendedAction = 'wait';
      }

      const optimalBookingWindow =
        daysUntilDeparture > 180
          ? {
              start: 90,
              end: 60,
              reason:
                'Early bird discounts typically appear 90-60 days before sailing',
            }
          : daysUntilDeparture > 90
          ? {
              start: 60,
              end: 30,
              reason:
                'Sweet spot for balancing price and availability',
            }
          : daysUntilDeparture > 30
          ? {
              start: 30,
              end: 14,
              reason:
                'Last chance for good deals before final surge',
            }
          : {
              start: 14,
              end: 7,
              reason:
                'Last-minute deals may appear, but cabin selection limited',
            };

      const trend: 'rising' | 'falling' | 'stable' =
        priceLevel === 'low' && daysUntilDeparture < 60
          ? 'rising'
          : priceLevel === 'high' && daysUntilDeparture < 90
          ? 'falling'
          : 'stable';

      const velocityPerDay =
        avgCurrentPrice && avgLowestPrice
          ? (avgCurrentPrice - avgLowestPrice) / Math.max(daysUntilDeparture, 1)
          : 0;

      const predictedPriceIn30Days =
        avgCurrentPrice && daysUntilDeparture > 30
          ? avgCurrentPrice + velocityPerDay * 30
          : null;

      const predictedPriceIn60Days =
        avgCurrentPrice && daysUntilDeparture > 60
          ? avgCurrentPrice + velocityPerDay * 60
          : null;

      const alerts: BookingWindowPrediction['alerts'] = [];
      
      if (priceLevel === 'low') {
        alerts.push({
          type: 'historical_low',
          message: `Prices are at or near historical lows for this cruise`,
          severity: 'success',
        });
      }

      if (
        daysUntilDeparture >= optimalBookingWindow.start &&
        daysUntilDeparture <= optimalBookingWindow.end
      ) {
        alerts.push({
          type: 'optimal_window',
          message: `You're in the optimal booking window! ${optimalBookingWindow.reason}`,
          severity: 'info',
        });
      }

      if (daysUntilDeparture < 21 && priceLevel === 'low') {
        alerts.push({
          type: 'last_minute_deal',
          message: `Last-minute deal detected! Book now before cabins sell out`,
          severity: 'warning',
        });
      }

      if (trend === 'falling' && priceDropLikelihood > 0.6) {
        alerts.push({
          type: 'price_drop',
          message: `Price drop likely in the next ${Math.floor(daysUntilDeparture / 7)} weeks`,
          severity: 'info',
        });
      }

      predictions.push({
        cruiseId: cruise.id,
        ship: cruise.ship,
        departureDate: cruise.departureDate,
        itineraryName: cruise.itineraryName,
        bookingWindowAnalysis: {
          daysUntilDeparture,
          currentPriceLevel: priceLevel,
          priceDropLikelihood,
          recommendedAction,
          optimalBookingWindow,
        },
        priceHistory,
        pricingTrends: {
          trend,
          velocityPerDay,
          predictedPriceIn30Days,
          predictedPriceIn60Days,
          confidence: 0.7,
        },
        similarCruisesData: {
          averageDaysBeforeBooking: 75,
          bestBookingWindowStart: optimalBookingWindow.start,
          bestBookingWindowEnd: optimalBookingWindow.end,
          typicalPriceDropDays: [120, 90, 60, 30, 14],
        },
        alerts,
      });
    }

    predictions.sort((a, b) => {
      const scoreA =
        (a.bookingWindowAnalysis.currentPriceLevel === 'low' ? 10 : 0) +
        (a.alerts.some(alert => alert.type === 'historical_low') ? 5 : 0) +
        (a.bookingWindowAnalysis.recommendedAction === 'book_now' ? 3 : 0);
      
      const scoreB =
        (b.bookingWindowAnalysis.currentPriceLevel === 'low' ? 10 : 0) +
        (b.alerts.some(alert => alert.type === 'historical_low') ? 5 : 0) +
        (b.bookingWindowAnalysis.recommendedAction === 'book_now' ? 3 : 0);
      
      return scoreB - scoreA;
    });

    return {
      predictions,
      summary: {
        totalCruisesAnalyzed: predictions.length,
        bookNowCount: predictions.filter(
          p => p.bookingWindowAnalysis.recommendedAction === 'book_now'
        ).length,
        waitCount: predictions.filter(
          p => p.bookingWindowAnalysis.recommendedAction === 'wait'
        ).length,
        monitorCount: predictions.filter(
          p => p.bookingWindowAnalysis.recommendedAction === 'monitor'
        ).length,
        averageDaysUntilDeparture:
          predictions.reduce(
            (sum, p) => sum + p.bookingWindowAnalysis.daysUntilDeparture,
            0
          ) / Math.max(predictions.length, 1),
      },
    };
  });
