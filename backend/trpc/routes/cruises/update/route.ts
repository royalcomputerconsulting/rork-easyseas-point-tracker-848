import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';
import type { Cruise } from '../../../../../types/models';

const updateCruiseSchema = z.object({
  id: z.string(),
  updates: z.object({
    ship: z.string().optional(),
    itineraryName: z.string().optional(),
    departureDate: z.string().optional(),
    returnDate: z.string().optional(),
    cabinNumber: z.string().optional(),
    categoryBooked: z.string().optional(),
    pricing: z.object({
      interior: z.number().optional(),
      oceanview: z.number().optional(),
      balcony: z.number().optional(),
      suite: z.number().optional(),
    }).optional(),
  })
});

export const updateCruiseProcedure = publicProcedure
  .input(updateCruiseSchema)
  .mutation(async ({ input }) => {
    console.log('[UpdateCruise] Updating cruise:', input.id, 'with updates:', input.updates);
    
    try {
      // Get current cruises from memory store
      const cruises = memoryStore.cruises;
      
      // Find the cruise to update
      const cruiseIndex = cruises.findIndex((cruise: any) => cruise.id === input.id);
      
      if (cruiseIndex === -1) {
        throw new Error(`Cruise with ID ${input.id} not found`);
      }
      
      // Update the cruise with the provided updates
      const updatedCruise = {
        ...cruises[cruiseIndex],
        ...input.updates,
        // Merge pricing if provided
        ...(input.updates.pricing && {
          pricing: {
            ...(cruises[cruiseIndex] as any).pricing,
            ...input.updates.pricing
          }
        }),
        updatedAt: new Date().toISOString()
      };
      
      // Replace the cruise in the array
      cruises[cruiseIndex] = updatedCruise;
      
      console.log('[UpdateCruise] Successfully updated cruise:', updatedCruise.id);
      
      return {
        success: true,
        cruise: updatedCruise,
        message: 'Cruise updated successfully'
      };
    } catch (error) {
      console.error('[UpdateCruise] Error updating cruise:', error);
      throw new Error(`Failed to update cruise: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

export const updateCruiseFinancialDataProcedure = publicProcedure
  .input(z.object({
    cruiseId: z.string(),
    userFinancialData: z.object({
      totalWinningsEarned: z.number().optional(),
      pointsEarnedOnCruise: z.number().optional(),
      actualAmountPaid: z.number().optional(),
      additionalFreeplayReceived: z.number().optional(),
    }),
  }))
  .mutation(async ({ input }) => {
    console.log('Updating cruise financial data:', input);
    
    const cruise = memoryStore.getCruise(input.cruiseId);
    
    if (!cruise) {
      throw new Error('Cruise not found');
    }
    
    // Calculate enhanced financial metrics
    const receiptData = memoryStore.getReceiptsByCruiseId(input.cruiseId)[0];
    const statementData = memoryStore.getCruiseStatementsByCruiseId(input.cruiseId)[0];
    
    // Determine data sources for pricing and financial data
    let pricingSource: 'receipt' | 'statement' | 'estimated' | 'user-input' = 'estimated';
    let financialSource: 'receipt' | 'statement' | 'estimated' | 'user-input' = 'user-input';
    
    if (receiptData) {
      pricingSource = 'receipt';
      if (!input.userFinancialData.actualAmountPaid && receiptData.totalPaid) {
        financialSource = 'receipt';
      }
    } else if (statementData) {
      pricingSource = 'statement';
      if (!input.userFinancialData.actualAmountPaid && statementData.totalPayments) {
        financialSource = 'statement';
      }
    }
    
    // Calculate real ROI and financial metrics
    const actualAmountPaid = input.userFinancialData.actualAmountPaid || 
                            receiptData?.totalPaid || 
                            statementData?.totalPayments || 
                            cruise.paidFare || 0;
    
    const winningsBroughtHome = input.userFinancialData.totalWinningsEarned || 0;
    const netOutOfPocket = actualAmountPaid - winningsBroughtHome;
    
    // Calculate total value back from receipt/statement data
    const retailPrice = receiptData?.totalFare || 
                       statementData?.cruiseFare || 
                       cruise.currentMarketPrice || 0;
    
    const spaCharges = statementData?.spa || 0;
    const internetCharges = statementData?.internetPackages || 0;
    const specialtyDiningCharges = statementData?.specialtyDining || 0;
    
    const totalValueBack = retailPrice + spaCharges + internetCharges + specialtyDiningCharges - winningsBroughtHome;
    const roiPercentage = netOutOfPocket > 0 ? ((totalValueBack - netOutOfPocket) / netOutOfPocket) * 100 : 0;
    
    // Calculate Club Royale Entertainment charges from statement
    const clubRoyaleEntertainmentCharges = statementData?.clubRoyaleEntertainmentCharges || 
                                          statementData?.casino || 0;
    
    const updatedCruise = memoryStore.updateCruise(input.cruiseId, {
      userFinancialData: {
        ...input.userFinancialData,
        lastUpdated: new Date().toISOString(),
      },
      dataSource: {
        pricing: pricingSource,
        financial: financialSource,
        points: input.userFinancialData.pointsEarnedOnCruise ? 'user-input' as const : cruise.dataSource?.points || 'calculated' as const,
        lastUpdated: new Date().toISOString(),
      },
      // Enhanced financial calculations
      netOutOfPocket,
      totalValueBack,
      roiPercentage,
      casinoCompedExtras: clubRoyaleEntertainmentCharges,
      winningsBroughtHome,
      cruisePointsEarned: input.userFinancialData.pointsEarnedOnCruise,
    });
    
    if (!updatedCruise) {
      throw new Error('Failed to update cruise');
    }
    
    console.log('Updated cruise financial data successfully with enhanced analytics');
    return updatedCruise;
  });

export const getCruiseFinancialDataProcedure = publicProcedure
  .input(z.object({
    cruiseId: z.string(),
  }))
  .query(async ({ input }) => {
    console.log('Getting cruise financial data for:', input.cruiseId);
    
    const cruise = memoryStore.getCruise(input.cruiseId);
    
    if (!cruise) {
      throw new Error('Cruise not found');
    }
    
    return {
      userFinancialData: cruise.userFinancialData,
      dataSource: cruise.dataSource,
    };
  });