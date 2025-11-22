import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';

// Get enhanced cruise financial data with data source indicators
export const getEnhancedCruiseDataProcedure = publicProcedure
  .input(z.object({
    cruiseId: z.string(),
  }))
  .query(async ({ input }) => {
    console.log('Getting enhanced cruise data for:', input.cruiseId);
    
    const cruise = memoryStore.getCruise(input.cruiseId);
    if (!cruise) {
      throw new Error('Cruise not found');
    }
    
    // Get receipt and statement data
    const receiptData = memoryStore.getReceiptsByCruiseId(input.cruiseId)[0];
    const statementData = memoryStore.getCruiseStatementsByCruiseId(input.cruiseId)[0];
    
    // Build enhanced financial breakdown with data source indicators
    const enhancedData = {
      cruise,
      
      // Pricing data with sources
      pricing: {
        retailPrice: {
          value: receiptData?.totalFare || statementData?.cruiseFare || cruise.currentMarketPrice || 0,
          source: receiptData ? 'receipt' : statementData ? 'statement' : 'estimated',
        },
        actualAmountPaid: {
          value: cruise.userFinancialData?.actualAmountPaid || receiptData?.totalPaid || statementData?.totalPayments || cruise.paidFare || 0,
          source: cruise.userFinancialData?.actualAmountPaid ? 'user-input' : receiptData ? 'receipt' : statementData ? 'statement' : 'estimated',
        },
        casinoDiscount: {
          value: 0, // Not available in current receipt structure
          source: 'estimated' as const,
        },
        freePlay: {
          value: cruise.userFinancialData?.additionalFreeplayReceived || 0,
          source: cruise.userFinancialData?.additionalFreeplayReceived ? 'user-input' as const : 'estimated' as const,
        },
      },
      
      // Club Royale Entertainment detailed breakdown
      clubRoyaleEntertainment: {
        totalCharges: {
          value: statementData?.clubRoyaleEntertainmentCharges || statementData?.casino || 0,
          source: statementData ? 'statement' : 'estimated',
        },
        categories: statementData?.lineItems ? 
          statementData.lineItems
            .filter((item: any) => item.category?.toLowerCase().includes('casino') || 
                           item.category?.toLowerCase().includes('club royale') ||
                           item.description?.toLowerCase().includes('casino') ||
                           item.description?.toLowerCase().includes('club royale'))
            .map((item: any) => ({
              date: item.date,
              category: item.category,
              description: item.description,
              amount: item.amount,
              source: 'statement' as const,
            })) : [],
      },
      
      // Onboard spending breakdown with sources
      onboardSpending: {
        spa: {
          value: statementData?.spa || 0,
          source: statementData ? 'statement' : 'estimated',
        },
        internet: {
          value: statementData?.internetPackages || 0,
          source: statementData ? 'statement' : 'estimated',
        },
        specialtyDining: {
          value: statementData?.specialtyDining || 0,
          source: statementData ? 'statement' : 'estimated',
        },
        beveragePackages: {
          value: statementData?.beveragePackages || 0,
          source: statementData ? 'statement' : 'estimated',
        },
        excursions: {
          value: statementData?.excursions || 0,
          source: statementData ? 'statement' : 'estimated',
        },
        photos: {
          value: statementData?.photos || 0,
          source: statementData ? 'statement' : 'estimated',
        },
        shopping: {
          value: statementData?.shopping || 0,
          source: statementData ? 'statement' : 'estimated',
        },
        otherCharges: {
          value: statementData?.otherCharges || 0,
          source: statementData ? 'statement' : 'estimated',
        },
      },
      
      // Financial calculations with sources
      calculations: {
        winningsBroughtHome: {
          value: cruise.userFinancialData?.totalWinningsEarned || cruise.winningsBroughtHome || 0,
          source: cruise.userFinancialData?.totalWinningsEarned ? 'user-input' : 'estimated',
        },
        netOutOfPocket: {
          value: cruise.netOutOfPocket || 0,
          source: cruise.userFinancialData ? 'calculated' : 'estimated',
        },
        totalValueBack: {
          value: cruise.totalValueBack || 0,
          source: cruise.userFinancialData ? 'calculated' : 'estimated',
        },
        roiPercentage: {
          value: cruise.roiPercentage || 0,
          source: cruise.userFinancialData ? 'calculated' : 'estimated',
        },
      },
      
      // Points data with source
      points: {
        pointsEarned: {
          value: cruise.cruisePointsEarned || 0,
          source: cruise.dataSource?.points || 'estimated',
        },
        coinIn: {
          value: (cruise.cruisePointsEarned || 0) * 5,
          source: cruise.dataSource?.points || 'estimated',
        },
      },
      
      // Data availability summary
      dataAvailability: {
        hasReceipt: !!receiptData,
        hasStatement: !!statementData,
        hasUserInput: !!cruise.userFinancialData,
        receiptId: receiptData?.id,
        statementId: statementData?.id,
        lastUpdated: cruise.dataSource?.lastUpdated || cruise.updatedAt,
      },
    };
    
    return enhancedData;
  });

// Get all Club Royale Entertainment categories for a cruise
export const getClubRoyaleCategoriesProcedure = publicProcedure
  .input(z.object({
    cruiseId: z.string(),
  }))
  .query(async ({ input }) => {
    console.log('Getting Club Royale categories for:', input.cruiseId);
    
    const statementData = memoryStore.getCruiseStatementsByCruiseId(input.cruiseId)[0];
    
    if (!statementData || !statementData.lineItems) {
      return {
        categories: [],
        totalAmount: 0,
        hasData: false,
      };
    }
    
    // Filter and categorize Club Royale Entertainment charges
    const casinoLineItems = statementData.lineItems.filter((item: any) => 
      item.category?.toLowerCase().includes('casino') || 
      item.category?.toLowerCase().includes('club royale') ||
      item.description?.toLowerCase().includes('casino') ||
      item.description?.toLowerCase().includes('club royale') ||
      item.description?.toLowerCase().includes('slot') ||
      item.description?.toLowerCase().includes('table') ||
      item.description?.toLowerCase().includes('poker') ||
      item.description?.toLowerCase().includes('blackjack') ||
      item.description?.toLowerCase().includes('roulette')
    );
    
    // Group by category/type
    const categorizedCharges = casinoLineItems.reduce((acc: Record<string, any[]>, item: any) => {
      let category = 'Other Casino Charges';
      
      const desc = item.description?.toLowerCase() || '';
      const cat = item.category?.toLowerCase() || '';
      
      if (desc.includes('slot') || cat.includes('slot')) {
        category = 'Slot Machines';
      } else if (desc.includes('table') || desc.includes('blackjack') || desc.includes('roulette') || desc.includes('poker')) {
        category = 'Table Games';
      } else if (desc.includes('bar') || desc.includes('drink')) {
        category = 'Casino Bar';
      } else if (desc.includes('tournament') || desc.includes('entry')) {
        category = 'Tournament Entry';
      } else if (desc.includes('comp') || desc.includes('credit')) {
        category = 'Comps & Credits';
      }
      
      if (!acc[category]) {
        acc[category] = [];
      }
      
      acc[category].push({
        date: item.date,
        description: item.description,
        amount: item.amount,
        category: item.category,
      });
      
      return acc;
    }, {} as Record<string, any[]>);
    
    // Calculate totals by category
    const categories = Object.entries(categorizedCharges).map(([categoryName, items]) => ({
      name: categoryName,
      items,
      total: (items as any[]).reduce((sum: number, item: any) => sum + item.amount, 0),
      count: (items as any[]).length,
    })).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)); // Sort by absolute amount
    
    const totalAmount = categories.reduce((sum, cat) => sum + cat.total, 0);
    
    return {
      categories,
      totalAmount,
      hasData: categories.length > 0,
      summary: {
        totalTransactions: casinoLineItems.length,
        totalCategories: categories.length,
        largestCategory: categories[0]?.name || null,
        largestAmount: categories[0]?.total || 0,
      },
    };
  });