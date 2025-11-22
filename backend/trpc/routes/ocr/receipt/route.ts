import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { memoryStore } from "../../_stores/memory";

// Helper function to clean JSON response from AI (removes markdown code blocks)
function cleanJsonResponse(response: string): string {
  console.log('[OCR] Raw AI response:', response.substring(0, 200) + '...');
  
  // Remove markdown code blocks if present
  let cleaned = response.trim();
  
  // Handle various markdown formats
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  // Remove any leading/trailing text that's not JSON
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }
  
  // Remove any remaining markdown artifacts
  cleaned = cleaned.replace(/^\s*```[a-z]*\s*/gm, '').replace(/\s*```\s*$/gm, '');
  
  console.log('[OCR] Cleaned response:', cleaned.substring(0, 200) + '...');
  return cleaned.trim();
}

const ocrReceiptSchema = z.object({
  imageBase64: z.string(),
  cruiseId: z.string().optional(), // Now optional - will create cruise if not provided
  bookingId: z.string().optional(),
});

export interface ReceiptData {
  id: string;
  cruiseId: string;
  reservationNumber?: string;
  guestNames?: string[];
  cabinNumber?: string;
  cabinType?: string;
  totalFare?: number;
  taxesAndFees?: number;
  gratuities?: number;
  totalPaid?: number;
  paymentMethod?: string;
  bookingDate?: string;
  departureDate?: string;
  returnDate?: string;
  ship?: string;
  itinerary?: string;
  ports?: string[];
  specialOffers?: string[];
  balanceDue?: number;
  finalPaymentDate?: string;
  createdAt: string;
  updatedAt: string;
}

export const ocrReceiptProcedure = protectedProcedure
  .input(ocrReceiptSchema)
  .mutation(async ({ input }: { input: { imageBase64: string; cruiseId?: string; bookingId?: string } }) => {
    console.log('[OCR] Processing receipt OCR for cruise:', input.cruiseId || 'auto-detect');
    
    try {
      // Call AI API to extract receipt data with retry logic
      let response: Response | null = null;
      let retryCount = 0;
      const maxRetries = 3;
      const timeoutMs = 90000; // 90 seconds timeout
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`[OCR] Receipt - Attempt ${retryCount + 1}/${maxRetries + 1}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            console.log('[OCR] Receipt - Request timeout reached, aborting...');
            controller.abort();
          }, timeoutMs);
          
          try {
            const apiUrl = 'https://toolkit.rork.com/text/llm/';
            console.log('[OCR] Receipt - Attempting to connect to external AI API:', apiUrl);
            
            // First, test if the service is reachable
            try {
              const testResponse = await fetch(apiUrl, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000) // 5 second timeout for connectivity test
              });
              console.log('[OCR] Receipt - Service connectivity test:', testResponse.status);
            } catch (connectivityError) {
              console.error('[OCR] Receipt - Service connectivity test failed:', connectivityError);
              throw new Error('External AI service is currently unavailable. The service may be down or experiencing issues. Please try again later.');
            }
            
            response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
              body: JSON.stringify({
                messages: [
                  {
                    role: 'system',
                    content: `You are a precise OCR system for cruise booking receipts. Extract ALL booking information from the receipt image and return it as a JSON object with these fields:
                    {
                      "reservationNumber": "Confirmation/reservation number",
                      "guestNames": [],
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
                        image: input.imageBase64
                      }
                    ]
                  }
                ]
              })
            });
            
            clearTimeout(timeoutId);
            console.log('[OCR] Receipt - Request completed successfully');
            break; // Success, exit retry loop
            
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            console.error('[OCR] Receipt - External API fetch failed:', {
              name: fetchError.name,
              message: fetchError.message,
              code: fetchError.code,
              cause: fetchError.cause
            });
            
            // Provide more specific error information
            if (fetchError.name === 'AbortError') {
              throw new Error('Request timed out. The external AI service is taking too long to respond.');
            } else if (fetchError.message?.includes('fetch')) {
              throw new Error('Cannot connect to external AI service. Please check your internet connection or try again later.');
            } else if (fetchError.code === 'ENOTFOUND' || fetchError.code === 'ECONNREFUSED') {
              throw new Error('External AI service is currently unavailable. Please try again later.');
            } else {
              throw new Error(`External AI service error: ${fetchError.message}`);
            }
          }
          
        } catch (error: any) {
          console.error(`[OCR] Receipt - Attempt ${retryCount + 1} failed:`, {
            name: error.name,
            message: error.message
          });
          
          if (error.name === 'AbortError') {
            console.log('[OCR] Receipt - Request was aborted (timeout)');
            if (retryCount === maxRetries) {
              throw new Error('External AI service timed out after multiple attempts. The service may be overloaded or your internet connection may be unstable. Please try again later or use a smaller image.');
            }
          } else if (error.message?.includes('fetch')) {
            console.log('[OCR] Receipt - Network/fetch error occurred');
            if (retryCount === maxRetries) {
              throw new Error('Cannot connect to external AI service after multiple attempts. The service may be down or your internet connection may be unstable. Please check your connection and try again later.');
            }
          } else {
            console.log('[OCR] Receipt - Unknown error occurred');
            if (retryCount === maxRetries) {
              throw new Error(`Processing failed after ${maxRetries + 1} attempts: ${error.message}`);
            }
          }
          
          retryCount++;
          if (retryCount <= maxRetries) {
            const waitTime = Math.min(2000 * retryCount, 5000); // Progressive backoff, max 5s
            console.log(`[OCR] Receipt - Waiting ${waitTime}ms before retry`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      if (!response) {
        throw new Error('Failed to get response from AI API after all retry attempts');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OCR] AI API error response:', errorText);
        throw new Error(`AI API error: ${response.status} - ${errorText}`);
      }

      const aiResult = await response.json();
      let extractedReceipt: Partial<ReceiptData>;
      
      try {
        const cleanedResponse = cleanJsonResponse(aiResult.completion);
        extractedReceipt = JSON.parse(cleanedResponse);
        delete (extractedReceipt as any).guestNames;
      } catch (error) {
        console.error('[OCR] Failed to parse AI response as JSON:', error, aiResult.completion);
        throw new Error('Failed to parse receipt data from image');
      }

      // Find or create cruise based on extracted data
      let targetCruiseId = input.cruiseId;
      
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
            departurePort: 'Unknown Port', // Will be updated if available in receipt
            departureDate: extractedReceipt.departureDate!,
            returnDate: extractedReceipt.returnDate || extractedReceipt.departureDate!,
            nights: extractedReceipt.returnDate ? 
              Math.ceil((new Date(extractedReceipt.returnDate).getTime() - new Date(extractedReceipt.departureDate!).getTime()) / (1000 * 60 * 60 * 24)) : 7,
            line: 'Royal Caribbean', // Default, could be extracted from receipt
            region: 'Unknown',
            stateroomTypes: [extractedReceipt.cabinType || 'Interior'],
            status: 'on_sale' as const,
            // DO NOT set bookingId for past cruises with receipts - they are completed, not booked
            // bookingId: undefined, // Past cruises should not appear as "booked"
            reservationNumber: extractedReceipt.reservationNumber,
            paidFare: extractedReceipt.totalPaid,
            actualFare: extractedReceipt.totalFare,
            cabinType: extractedReceipt.cabinType
          });
          targetCruiseId = newCruise.id;
          console.log('[OCR] Created new cruise from receipt:', targetCruiseId);
        }
      }
      
      if (!targetCruiseId) {
        throw new Error('Could not determine cruise for receipt. Please provide cruise ID or ensure receipt contains ship name and departure date.');
      }

      // Create receipt record
      const receipt: ReceiptData = {
        id: `receipt_${Date.now()}`,
        cruiseId: targetCruiseId,
        reservationNumber: extractedReceipt.reservationNumber,

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
        finalPaymentDate: extractedReceipt.finalPaymentDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store receipt data using memory store method
      const storedReceipt = memoryStore.createReceipt({
        cruiseId: targetCruiseId,
        reservationNumber: extractedReceipt.reservationNumber || input.bookingId,

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

      // Automatically populate financials database from receipt
      const financialRecord = {
        cruiseId: targetCruiseId,
        shipName: extractedReceipt.ship,
        sailDateStart: extractedReceipt.departureDate,
        sailDateEnd: extractedReceipt.returnDate,
        itineraryName: extractedReceipt.itinerary,
        cabinNumber: extractedReceipt.cabinNumber,
        reservationNumber: extractedReceipt.reservationNumber,
        sourceType: 'receipt' as const,
        sourceFileBaseName: 'ocr-receipt',
        processedAt: new Date().toISOString(),
        verified: true,
        receiptId: storedReceipt.id,
        venue: 'Cruise Fare',
        category: 'Other' as const,
        itemDescription: 'Cruise Booking',
        lineTotal: extractedReceipt.totalPaid,
        tax: extractedReceipt.taxesAndFees,
        gratuity: extractedReceipt.gratuities,
        discount: extractedReceipt.specialOffers?.reduce((sum, offer) => {
          const match = offer.match(/\$([\d,]+\.\d{2})/);
          return sum + (match ? parseFloat(match[1].replace(',', '')) : 0);
        }, 0) || 0,
        paymentMethod: extractedReceipt.paymentMethod === 'Credit Card' ? 'Credit Card' as const : 'SeaPass' as const,
      };
      memoryStore.addFinancials([financialRecord]);
      console.log('[OCR] Added receipt to financials database');

      // Update the associated cruise with receipt data if available
      const cruise = memoryStore.getCruise(targetCruiseId);
      if (cruise && extractedReceipt.totalFare) {
        cruise.updatedAt = new Date().toISOString();
        // Could add receipt reference to cruise
      }

      console.log(`[OCR] Added receipt for cruise ${targetCruiseId}`);
      
      return {
        success: true,
        receipt,
        extractedData: extractedReceipt,
        cruiseId: targetCruiseId,
        cruiseCreated: !input.cruiseId // Indicates if we created a new cruise
      };
      
    } catch (error) {
      console.error('[OCR] Receipt processing error:', error);
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });