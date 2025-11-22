import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { memoryStore } from "../../_stores/memory";
import type { ReceiptData } from "../receipt/route";

const batchReceiptsSchema = z.object({
  receipts: z.array(z.object({
    imageUrl: z.string(),
    cruiseId: z.string().optional(),
    bookingId: z.string().optional(),
    description: z.string().optional()
  }))
});

export const batchReceiptsProcedure = protectedProcedure
  .input(batchReceiptsSchema)
  .mutation(async ({ input }) => {
    console.log('[OCR] Processing batch receipts:', input.receipts.length);
    
    const results: Array<{
      success: boolean;
      receipt?: ReceiptData;
      error?: string;
      cruiseId?: string;
      cruiseCreated?: boolean;
      description?: string;
    }> = [];
    
    for (let i = 0; i < input.receipts.length; i++) {
      const receiptInput = input.receipts[i];
      console.log(`[OCR] Processing receipt ${i + 1}/${input.receipts.length}: ${receiptInput.description || receiptInput.imageUrl}`);
      
      try {
        // Fetch image and convert to base64
        const imageResponse = await fetch(receiptInput.imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }
        
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');
        
        // Call AI API to extract receipt data
        const aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: `You are a precise OCR system for cruise booking receipts. Extract ALL booking information from the receipt image and return it as a JSON object with these fields:
                {
                  "reservationNumber": "Confirmation/reservation number",
                  "guestNames": ["Guest 1", "Guest 2"],
                  "cabinNumber": "Cabin number if shown",
                  "cabinType": "Interior|Oceanview|Balcony|Suite",
                  "totalFare": number (base cruise fare),
                  "taxesAndFees": number,
                  "gratuities": number,
                  "totalPaid": number (actual amount paid),
                  "paymentMethod": "Payment method",
                  "bookingDate": "YYYY-MM-DD",
                  "departureDate": "YYYY-MM-DD",
                  "returnDate": "YYYY-MM-DD",
                  "ship": "Ship name",
                  "itinerary": "Itinerary description",
                  "ports": ["Port 1", "Port 2"],
                  "specialOffers": ["Any special offers or discounts mentioned"],
                  "balanceDue": number (if any balance remaining),
                  "finalPaymentDate": "YYYY-MM-DD if shown",
                  "casinoDiscount": number,
                  "freePlay": number,
                  "lineItems": [
                    {
                      "description": "Line item description",
                      "amount": number
                    }
                  ]
                }
                
                CRITICAL: For Royal Caribbean receipts, look for casino-related discounts in the fare breakdown. Common line items include:
                - "Casino Comp" with negative amounts (discounts)
                - "YHPS-Casino Slots" with negative amounts
                - "YKD9-Casino Upgrade" with negative amounts
                - Any FreePlay offers mentioned in special offers or perks
                
                Extract the total casino discount amount and any FreePlay amounts separately. Also capture all individual line items.
                
                Be extremely precise with dates and numbers. Convert any date format to YYYY-MM-DD. Extract all financial details accurately. Return only valid JSON object, no other text.`
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Extract all booking and payment information from this cruise receipt image:'
                  },
                  {
                    type: 'image',
                    image: imageBase64
                  }
                ]
              }
            ]
          })
        });
        
        if (!aiResponse.ok) {
          throw new Error(`AI API error: ${aiResponse.status}`);
        }
        
        const aiResult = await aiResponse.json();
        let extractedReceipt: Partial<ReceiptData>;
        
        try {
          extractedReceipt = JSON.parse(aiResult.completion);
        } catch (error) {
          throw new Error('Failed to parse receipt data from image');
        }
        
        // Find or create cruise based on extracted data
        let targetCruiseId = receiptInput.cruiseId;
        let cruiseCreated = false;
        
        if (!targetCruiseId && extractedReceipt.ship && extractedReceipt.departureDate) {
          // Try to find existing cruise that matches
          const matchingCruise = memoryStore.getCruises().find(cruise => 
            cruise.ship.toLowerCase().includes(extractedReceipt.ship!.toLowerCase()) &&
            cruise.departureDate === extractedReceipt.departureDate
          );
          
          if (matchingCruise) {
            console.log('[OCR] Found matching existing cruise:', matchingCruise.id);
            targetCruiseId = matchingCruise.id;
          } else {
            // Create new cruise from receipt data
            console.log('[OCR] Creating new cruise from receipt data');
            const newCruise = memoryStore.createCruise({
              ship: extractedReceipt.ship!,
              itineraryName: extractedReceipt.itinerary || 'Unknown Itinerary',
              departurePort: 'Unknown Port',
              departureDate: extractedReceipt.departureDate!,
              returnDate: extractedReceipt.returnDate || extractedReceipt.departureDate!,
              nights: extractedReceipt.returnDate ? 
                Math.ceil((new Date(extractedReceipt.returnDate).getTime() - new Date(extractedReceipt.departureDate!).getTime()) / (1000 * 60 * 60 * 24)) : 7,
              line: 'Royal Caribbean',
              region: 'Unknown',
              stateroomTypes: [extractedReceipt.cabinType || 'Interior'],
              status: 'on_sale' as const,
              bookingId: extractedReceipt.reservationNumber,
              reservationNumber: extractedReceipt.reservationNumber,
              paidFare: extractedReceipt.totalPaid,
              actualFare: extractedReceipt.totalFare,
              cabinType: extractedReceipt.cabinType
            });
            targetCruiseId = newCruise.id;
            cruiseCreated = true;
            console.log('[OCR] Created new cruise from receipt:', targetCruiseId);
          }
        }
        
        if (!targetCruiseId) {
          throw new Error('Could not determine cruise for receipt');
        }
        
        // Create receipt record
        const receipt = memoryStore.createReceipt({
          cruiseId: targetCruiseId,
          reservationNumber: extractedReceipt.reservationNumber || receiptInput.bookingId,
          guestNames: extractedReceipt.guestNames,
          cabinNumber: extractedReceipt.cabinNumber,
          cabinType: extractedReceipt.cabinType,
          totalFare: extractedReceipt.totalFare,
          taxesAndFees: extractedReceipt.taxesAndFees,
          gratuities: extractedReceipt.gratuities,
          totalPaid: extractedReceipt.totalPaid,
          paymentMethod: extractedReceipt.paymentMethod,
          bookingDate: extractedReceipt.bookingDate,
          departureDate: extractedReceipt.departureDate,
          returnDate: extractedReceipt.returnDate,
          ship: extractedReceipt.ship,
          itinerary: extractedReceipt.itinerary,
          ports: extractedReceipt.ports,
          specialOffers: extractedReceipt.specialOffers,
          balanceDue: extractedReceipt.balanceDue,
          finalPaymentDate: extractedReceipt.finalPaymentDate
        });
        
        results.push({
          success: true,
          receipt,
          cruiseId: targetCruiseId,
          cruiseCreated,
          description: receiptInput.description
        });
        
        console.log(`[OCR] Successfully processed receipt ${i + 1}`);
        
      } catch (error) {
        console.error(`[OCR] Failed to process receipt ${i + 1}:`, error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          description: receiptInput.description
        });
      }
      
      // Add delay between requests to avoid rate limiting
      if (i < input.receipts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`[OCR] Batch processing complete: ${successful} successful, ${failed} failed`);
    
    return {
      success: successful > 0,
      processed: results.length,
      successful,
      failed,
      results
    };
  });