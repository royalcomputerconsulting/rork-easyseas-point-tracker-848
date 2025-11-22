import { z } from 'zod';
import { publicProcedure } from '@/backend/trpc/create-context';
const cruiseAiSchema = z.object({
  cruise: z.object({
    id: z.union([z.string(), z.number()]),
    ship: z.string(),
    sailDate: z.string(),
    nights: z.number(),
    amountPaid: z.number(),
    retailPrice: z.number(),
    casinoComp: z.number(),
    freePlay: z.number(),
    winnings: z.number(),
    pointsEarned: z.number(),
    tier: z.string().optional(),
  }),
});

export const cruiseAiProcedure = publicProcedure
  .input(cruiseAiSchema)
  .mutation(async ({ input }) => {
    console.log('[3.2] AI analyzing cruise', input.cruise.id);
    
    const { cruise } = input;
    
    // Calculate key metrics
    const totalValue = cruise.retailPrice + cruise.casinoComp + cruise.freePlay + cruise.winnings;
    const roi = ((totalValue - cruise.amountPaid) / cruise.amountPaid) * 100;
    const valuePerPoint = totalValue / cruise.pointsEarned;
    const coinIn = cruise.casinoComp * 10; // Estimate: 1% comp rate
    const actualRisk = cruise.amountPaid;
    const riskMultiplier = coinIn / actualRisk;
    
    // Create AI prompt for cruise analysis
    const prompt = `Analyze this Royal Caribbean cruise from a casino gaming perspective:

**Cruise Details:**
- Ship: ${cruise.ship}
- Sail Date: ${new Date(cruise.sailDate).toLocaleDateString()}
- Duration: ${cruise.nights} nights
- Tier: ${cruise.tier || 'Unknown'}

**Financial Performance:**
- Amount Paid: $${cruise.amountPaid.toLocaleString()}
- Retail Price: $${cruise.retailPrice.toLocaleString()}
- Casino Comp: $${cruise.casinoComp.toLocaleString()}
- Free Play: $${cruise.freePlay.toLocaleString()}
- Winnings: $${cruise.winnings.toLocaleString()}
- Total Value: $${totalValue.toLocaleString()}
- ROI: ${roi.toFixed(1)}%

**Gaming Metrics:**
- Points Earned: ${cruise.pointsEarned.toLocaleString()}
- Value per Point: $${valuePerPoint.toFixed(2)}
- Estimated Coin-In: $${coinIn.toLocaleString()}
- Actual Risk: $${actualRisk.toLocaleString()}
- Risk Multiplier: ${riskMultiplier.toFixed(1)}x

Provide a concise analysis covering:
1. **Casino Performance**: How well did the casino strategy work?
2. **Risk Assessment**: Compare coin-in vs actual cash risk
3. **Value Optimization**: Was this cruise a good value?
4. **Strategic Insights**: What can be learned for future cruises?

Keep it under 200 words, professional but engaging tone.`;

    try {
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a casino gaming analyst specializing in Royal Caribbean cruise strategies. Provide insightful, data-driven analysis.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('[3.2] AI analysis completed for cruise', cruise.id);
      
      return {
        success: true,
        analysis: data.completion,
        metrics: {
          roi,
          valuePerPoint,
          coinIn,
          actualRisk,
          riskMultiplier,
          totalValue,
        },
      };
    } catch (error) {
      console.error('[3.2] AI analysis failed:', error);
      
      // Fallback analysis
      const fallbackAnalysis = `**${cruise.ship} Analysis**\n\n` +
        `This ${cruise.nights}-night cruise delivered a ${roi.toFixed(1)}% ROI. ` +
        `With $${cruise.casinoComp.toLocaleString()} in casino comps and $${cruise.freePlay.toLocaleString()} free play, ` +
        `the casino strategy ${roi > 200 ? 'performed excellently' : roi > 100 ? 'worked well' : 'had mixed results'}. ` +
        `The estimated $${coinIn.toLocaleString()} coin-in vs $${actualRisk.toLocaleString()} actual risk shows a ${riskMultiplier.toFixed(1)}x multiplier, ` +
        `${riskMultiplier > 5 ? 'indicating strong casino perception value' : 'suggesting moderate casino engagement'}. ` +
        `At $${valuePerPoint.toFixed(2)} per point, this cruise ${valuePerPoint < 2 ? 'delivered excellent point value' : 'provided reasonable point value'}.`;
      
      return {
        success: true,
        analysis: fallbackAnalysis,
        metrics: {
          roi,
          valuePerPoint,
          coinIn,
          actualRisk,
          riskMultiplier,
          totalValue,
        },
      };
    }
  });