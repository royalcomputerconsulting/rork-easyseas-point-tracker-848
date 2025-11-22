import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';
import type { FinancialsRecord } from '@/types/models';

/**
 * Intelligence Feature 8: Benchmarking & Peer Comparison
 * Compare player performance against aggregated benchmarks
 */

interface ShipBenchmark {
  shipName: string;
  avgCoinInPerNight: number;
  avgPointsPerNight: number;
  avgRetailValue: number;
  avgOutOfPocket: number;
  totalCruises: number;
  avgROI: number;
}

interface PlayerBenchmark {
  shipName: string;
  playerCoinInPerNight: number;
  playerPointsPerNight: number;
  playerRetailValue: number;
  playerOutOfPocket: number;
  comparisonToAverage: {
    coinInDiff: number;
    pointsDiff: number;
    retailValueDiff: number;
    outOfPocketDiff: number;
    roiDiff: number;
  };
  ranking: 'above-average' | 'average' | 'below-average';
}

export const benchmarkingProcedure = publicProcedure.query(() => {
  console.log('[tRPC] Generating benchmarking and peer comparison');
  
  try {
    const financials = memoryStore.getFinancials();
    const cruises = memoryStore.getCruises();
    const statements = memoryStore.getCruiseStatements();
    
    if (financials.length === 0 && statements.length === 0) {
      return {
        shipBenchmarks: [],
        playerBenchmarks: [],
        overallStats: {
          totalCruises: 0,
          avgCoinInPerNight: 0,
          avgPointsPerNight: 0,
          avgROI: 0
        },
        insights: ['No financial data available for benchmarking. Complete some cruises to see comparisons.']
      };
    }
    
    // Calculate ship-level benchmarks from all financial data
    const shipStats = new Map<string, {
      totalCoinIn: number;
      totalPoints: number;
      totalRetailValue: number;
      totalOutOfPocket: number;
      totalNights: number;
      cruiseCount: number;
    }>();
    
    // Group financials by cruise and ship
    const cruiseFinancials = new Map<string, FinancialsRecord[]>();
    financials.forEach(f => {
      if (!cruiseFinancials.has(f.cruiseId)) {
        cruiseFinancials.set(f.cruiseId, []);
      }
      cruiseFinancials.get(f.cruiseId)!.push(f);
    });
    
    // Process each cruise's financials
    cruiseFinancials.forEach((records, cruiseId) => {
      const cruise = cruises.find(c => c.id === cruiseId);
      const cruiseStatement = statements.find(s => s.cruiseId === cruiseId);
      
      if (!cruise) return;
      
      const shipName = records[0]?.shipName || cruise.ship || 'Unknown';
      const nights = cruise.nights || 7;
      
      // Calculate metrics from statements (more accurate than financials records)
      let coinIn = 0;
      let points = 0;
      let retailValue = 0;
      let outOfPocket = 0;
      
      if (cruiseStatement) {
        // Use statement data if available
        coinIn = cruiseStatement.clubRoyaleEntertainmentCharges || cruiseStatement.casino || 0;
        points = Math.floor(coinIn / 5); // 1 point per $5
        retailValue = cruise.currentMarketPrice || cruise.actualFare || 0;
        outOfPocket = cruise.paidFare || cruise.netOutOfPocket || 0;
      } else {
        // Fallback to aggregating financials records
        records.forEach(record => {
          // Calculate casino spending from statement records
          if (record.sourceType === 'statement' && record.department === 'Casino') {
            coinIn += Math.abs(record.amount || 0);
          }
          // Calculate retail value from receipt records
          if (record.sourceType === 'receipt') {
            retailValue += (record.lineTotal || 0);
          }
        });
        
        points = Math.floor(coinIn / 5);
        outOfPocket = cruise.paidFare || 0;
      }
      
      // Update ship statistics
      if (!shipStats.has(shipName)) {
        shipStats.set(shipName, {
          totalCoinIn: 0,
          totalPoints: 0,
          totalRetailValue: 0,
          totalOutOfPocket: 0,
          totalNights: 0,
          cruiseCount: 0
        });
      }
      
      const stats = shipStats.get(shipName)!;
      stats.totalCoinIn += coinIn;
      stats.totalPoints += points;
      stats.totalRetailValue += retailValue;
      stats.totalOutOfPocket += outOfPocket;
      stats.totalNights += nights;
      stats.cruiseCount += 1;
    });
    
    // Calculate ship benchmarks
    const shipBenchmarks: ShipBenchmark[] = [];
    shipStats.forEach((stats, shipName) => {
      const avgCoinInPerNight = stats.totalNights > 0 ? stats.totalCoinIn / stats.totalNights : 0;
      const avgPointsPerNight = stats.totalNights > 0 ? stats.totalPoints / stats.totalNights : 0;
      const avgRetailValue = stats.cruiseCount > 0 ? stats.totalRetailValue / stats.cruiseCount : 0;
      const avgOutOfPocket = stats.cruiseCount > 0 ? stats.totalOutOfPocket / stats.cruiseCount : 0;
      const avgROI = stats.totalOutOfPocket > 0 ? 
        ((stats.totalRetailValue - stats.totalOutOfPocket) / stats.totalOutOfPocket) * 100 : 0;
      
      shipBenchmarks.push({
        shipName,
        avgCoinInPerNight,
        avgPointsPerNight,
        avgRetailValue,
        avgOutOfPocket,
        totalCruises: stats.cruiseCount,
        avgROI
      });
    });
    
    // Calculate player benchmarks (compare player to ship averages)
    const playerBenchmarks: PlayerBenchmark[] = shipBenchmarks.map(benchmark => {
      // For now, player stats = ship stats (single player app)
      // In multi-user scenario, this would compare player to other players on same ship
      
      const playerStats = shipStats.get(benchmark.shipName);
      if (!playerStats) {
        return {
          shipName: benchmark.shipName,
          playerCoinInPerNight: 0,
          playerPointsPerNight: 0,
          playerRetailValue: 0,
          playerOutOfPocket: 0,
          comparisonToAverage: {
            coinInDiff: 0,
            pointsDiff: 0,
            retailValueDiff: 0,
            outOfPocketDiff: 0,
            roiDiff: 0
          },
          ranking: 'average' as const
        };
      }
      
      const playerCoinInPerNight = playerStats.totalNights > 0 ? playerStats.totalCoinIn / playerStats.totalNights : 0;
      const playerPointsPerNight = playerStats.totalNights > 0 ? playerStats.totalPoints / playerStats.totalNights : 0;
      const playerRetailValue = playerStats.cruiseCount > 0 ? playerStats.totalRetailValue / playerStats.cruiseCount : 0;
      const playerOutOfPocket = playerStats.cruiseCount > 0 ? playerStats.totalOutOfPocket / playerStats.cruiseCount : 0;
      const playerROI = playerStats.totalOutOfPocket > 0 ?
        ((playerStats.totalRetailValue - playerStats.totalOutOfPocket) / playerStats.totalOutOfPocket) * 100 : 0;
      
      const comparisonToAverage = {
        coinInDiff: ((playerCoinInPerNight - benchmark.avgCoinInPerNight) / Math.max(benchmark.avgCoinInPerNight, 1)) * 100,
        pointsDiff: ((playerPointsPerNight - benchmark.avgPointsPerNight) / Math.max(benchmark.avgPointsPerNight, 1)) * 100,
        retailValueDiff: ((playerRetailValue - benchmark.avgRetailValue) / Math.max(benchmark.avgRetailValue, 1)) * 100,
        outOfPocketDiff: ((playerOutOfPocket - benchmark.avgOutOfPocket) / Math.max(benchmark.avgOutOfPocket, 1)) * 100,
        roiDiff: playerROI - benchmark.avgROI
      };
      
      // Determine ranking based on ROI comparison
      let ranking: 'above-average' | 'average' | 'below-average' = 'average';
      if (comparisonToAverage.roiDiff > 10) ranking = 'above-average';
      else if (comparisonToAverage.roiDiff < -10) ranking = 'below-average';
      
      return {
        shipName: benchmark.shipName,
        playerCoinInPerNight,
        playerPointsPerNight,
        playerRetailValue,
        playerOutOfPocket,
        comparisonToAverage,
        ranking
      };
    });
    
    // Calculate overall statistics
    const totalNights = Array.from(shipStats.values()).reduce((sum, stats) => sum + stats.totalNights, 0);
    const totalCruises = Array.from(shipStats.values()).reduce((sum, stats) => sum + stats.cruiseCount, 0);
    const totalCoinIn = Array.from(shipStats.values()).reduce((sum, stats) => sum + stats.totalCoinIn, 0);
    const totalPoints = Array.from(shipStats.values()).reduce((sum, stats) => sum + stats.totalPoints, 0);
    const totalRetailValue = Array.from(shipStats.values()).reduce((sum, stats) => sum + stats.totalRetailValue, 0);
    const totalOutOfPocket = Array.from(shipStats.values()).reduce((sum, stats) => sum + stats.totalOutOfPocket, 0);
    
    const overallStats = {
      totalCruises,
      avgCoinInPerNight: totalNights > 0 ? totalCoinIn / totalNights : 0,
      avgPointsPerNight: totalNights > 0 ? totalPoints / totalNights : 0,
      avgROI: totalOutOfPocket > 0 ? ((totalRetailValue - totalOutOfPocket) / totalOutOfPocket) * 100 : 0
    };
    
    // Generate insights
    const insights: string[] = [];
    
    // Find best performing ship
    const bestShip = shipBenchmarks.reduce((best, current) => 
      current.avgROI > best.avgROI ? current : best
    , shipBenchmarks[0]);
    
    if (bestShip) {
      insights.push(`${bestShip.shipName} is your most profitable ship with ${bestShip.avgROI.toFixed(1)}% average ROI`);
    }
    
    // Find highest point earner
    const highestPoints = shipBenchmarks.reduce((best, current) =>
      current.avgPointsPerNight > best.avgPointsPerNight ? current : best
    , shipBenchmarks[0]);
    
    if (highestPoints) {
      insights.push(`You earn the most points per night on ${highestPoints.shipName} (${highestPoints.avgPointsPerNight.toFixed(0)} points/night)`);
    }
    
    // Overall performance insight
    if (overallStats.avgROI > 50) {
      insights.push(`Excellent overall performance with ${overallStats.avgROI.toFixed(1)}% average ROI across all ships`);
    } else if (overallStats.avgROI > 25) {
      insights.push(`Good overall performance with ${overallStats.avgROI.toFixed(1)}% average ROI across all ships`);
    } else if (overallStats.avgROI > 0) {
      insights.push(`Positive overall performance with ${overallStats.avgROI.toFixed(1)}% average ROI across all ships`);
    } else {
      insights.push(`Consider optimizing strategy - current average ROI is ${overallStats.avgROI.toFixed(1)}%`);
    }
    
    return {
      shipBenchmarks: shipBenchmarks.sort((a, b) => b.avgROI - a.avgROI),
      playerBenchmarks: playerBenchmarks.sort((a, b) => b.comparisonToAverage.roiDiff - a.comparisonToAverage.roiDiff),
      overallStats,
      insights
    };
    
  } catch (error) {
    console.error('[tRPC] Benchmarking analysis failed:', error);
    return {
      shipBenchmarks: [],
      playerBenchmarks: [],
      overallStats: {
        totalCruises: 0,
        avgCoinInPerNight: 0,
        avgPointsPerNight: 0,
        avgROI: 0
      },
      insights: ['Benchmarking analysis temporarily unavailable']
    };
  }
});
