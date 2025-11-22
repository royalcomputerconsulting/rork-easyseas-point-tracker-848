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

const ocrCruiseStatementSchema = z.object({
  files: z.array(z.object({
    base64: z.string(),
    type: z.enum(['image', 'pdf']),
    name: z.string()
  })),
  cruiseId: z.string().optional(), // Now optional - will create cruise if not provided
  bookingId: z.string().optional(),
});

export interface CruiseStatementData {
  id: string;
  cruiseId: string;
  reservationNumber?: string;
  statementDate?: string;
  guestNames?: string[];
  cabinNumber?: string;
  cabinType?: string;
  ship?: string;
  itinerary?: string;
  departureDate?: string;
  returnDate?: string;
  ports?: string[];
  
  // Financial breakdown
  cruiseFare?: number;
  taxesAndFees?: number;
  gratuities?: number;
  onboardCharges?: number;
  excursions?: number;
  beveragePackages?: number;
  internetPackages?: number;
  specialtyDining?: number;
  photos?: number;
  spa?: number;
  casino?: number;
  shopping?: number;
  otherCharges?: number;
  totalCharges?: number;
  
  // Enhanced Club Royale Entertainment charges - sum of all casino line items
  clubRoyaleEntertainmentCharges?: number;
  
  // Payments
  deposits?: number;
  finalPayment?: number;
  onboardPayments?: number;
  totalPayments?: number;
  balanceDue?: number;
  
  // Account summary
  accountNumber?: string;
  folio?: string;
  
  createdAt: string;
  updatedAt: string;
}

export const ocrCruiseStatementProcedure = protectedProcedure
  .input(ocrCruiseStatementSchema)
  .mutation(async ({ input }: { input: { files: {base64: string, type: 'image' | 'pdf', name: string}[], cruiseId?: string, bookingId?: string } }) => {
    console.log(`[OCR] Processing cruise statement OCR for cruise: ${input.cruiseId || 'auto-detect'}, files: ${input.files.length}`);
    
    function parseSourceInfo(allFiles: { name: string }[], currentIndex: number) {
      const names = allFiles.map(f => f.name);
      const stripExt = (n: string) => n.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
      const baseParts = stripExt(names[currentIndex])
        .replace(/[_-]page[_-]?\d+$/i, '')
        .replace(/[_-](p|pg|page)?\d+of\d+$/i, '')
        .replace(/\(\d+\)$/,'');
      const sameBase = names.filter(n => stripExt(n).startsWith(baseParts));
      const totalPages = Math.max(1, sameBase.length);
      const pageNumber = Math.min(totalPages, currentIndex + 1);
      const sourceFileBaseName = baseParts;
      return { sourceFileBaseName, sourcePageNumber: pageNumber, sourceTotalPages: totalPages };
    }
    
    try {
      const processedStatements: CruiseStatementData[] = [];
      
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        console.log(`[OCR] Processing file: ${file.name} (${file.type})`);
        
        // Call AI API to extract statement data with retry logic
        let response: Response | null = null;
        let retryCount = 0;
        const maxRetries = 3;
        const timeoutMs = 120000; // 2 minutes timeout for statements (can be complex)
        
        while (retryCount <= maxRetries) {
          try {
            console.log(`[OCR] Statement - Attempt ${retryCount + 1}/${maxRetries + 1} for ${file.name}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
              console.log('[OCR] Statement - Request timeout reached, aborting...');
              controller.abort();
            }, timeoutMs);
            
            try {
              const apiUrl = file.type === 'pdf' 
                ? 'https://toolkit.rork.com/text/llm/' // For PDF, we'll use text extraction
                : 'https://toolkit.rork.com/text/llm/';
              
              console.log('[OCR] Statement - Attempting to connect to external AI API:', apiUrl);
              
              // Test connectivity
              try {
                const testResponse = await fetch(apiUrl, {
                  method: 'HEAD',
                  signal: AbortSignal.timeout(5000)
                });
                console.log('[OCR] Statement - Service connectivity test:', testResponse.status);
              } catch (connectivityError) {
                console.error('[OCR] Statement - Service connectivity test failed:', connectivityError);
                throw new Error('External AI service is currently unavailable. Please try again later.');
              }
              
              const messages = [
                {
                  role: 'system',
                  content: `You are a precise OCR system for cruise account statements and folios. Extract ALL financial and booking information from the cruise statement and return it as a JSON object with these fields:
                  {
                    "reservationNumber": "Confirmation/reservation number",
                    "statementDate": "YYYY-MM-DD",
                    "guestNames": [],
                    "cabinNumber": "Cabin number",
                    "cabinType": "Interior|Oceanview|Balcony|Suite",
                    "ship": "Ship name",
                    "itinerary": "Itinerary description",
                    "departureDate": "YYYY-MM-DD",
                    "returnDate": "YYYY-MM-DD",
                    "ports": ["Port 1", "Port 2"],
                    
                    "cruiseFare": number,
                    "taxesAndFees": number,
                    "gratuities": number,
                    "onboardCharges": number,
                    "excursions": number,
                    "beveragePackages": number,
                    "internetPackages": number,
                    "specialtyDining": number,
                    "photos": number,
                    "spa": number,
                    "casino": number,
                    "shopping": number,
                    "otherCharges": number,
                    "totalCharges": number,
                    
                    "deposits": number,
                    "finalPayment": number,
                    "onboardPayments": number,
                    "totalPayments": number,
                    "balanceDue": number,
                    
                    "accountNumber": "Account number if shown",
                    "folio": "Folio number if shown",
                    
                    "clubRoyaleEntertainmentCharges": number,
                    "lineItems": [
                      {
                        "date": "MM/DD",
                        "category": "GAMING|DINING|BEVERAGES|SPA|SHOPPING|EXCURSIONS|INTERNET|PHOTOS|SPECIALTY_DINING|GRATUITIES|OTHER",
                        "description": "Line item description",
                        "amount": number
                      }
                    ]
                  }
                  
                  CRITICAL: For Royal Caribbean statements, look for ALL line items that contain "CLUB ROYALE ENTERTAINMENT GAMES" or similar casino/gaming charges. Sum ALL these individual charges to get the total "clubRoyaleEntertainmentCharges" value. 
                  
                  EXTRACT ALL LINE ITEMS with proper categorization:
                  - GAMING: Club Royale Entertainment, Casino charges, Gaming fees
                  - DINING: Specialty restaurants, Chef's Table, room service
                  - BEVERAGES: Drink packages, bar charges, wine
                  - SPA: Spa treatments, fitness classes
                  - SHOPPING: Onboard purchases, duty-free
                  - EXCURSIONS: Shore excursions, tours
                  - INTERNET: WiFi packages, internet charges
                  - PHOTOS: Photo packages, professional photos
                  - SPECIALTY_DINING: Specialty dining venues
                  - GRATUITIES: Service charges, tips
                  - OTHER: Any other charges not fitting above categories
                  
                  Include ALL line items with their dates, proper categories, descriptions, and amounts.
                  
                  Be extremely precise with dates and numbers. Convert any date format to YYYY-MM-DD. Extract all financial details accurately including itemized charges. Return only valid JSON object, no other text.`
                },
                {
                  role: 'user',
                  content: file.type === 'pdf' ? [
                    {
                      type: 'text',
                      text: `Extract all financial and booking information from this cruise statement PDF. The PDF contains: ${file.name}`
                    },
                    {
                      type: 'image',
                      image: file.base64 // For PDF, we'll treat it as image for now
                    }
                  ] : [
                    {
                      type: 'text',
                      text: 'Extract all financial and booking information from this cruise statement image:'
                    },
                    {
                      type: 'image',
                      image: file.base64
                    }
                  ]
                }
              ];
              
              response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                signal: controller.signal,
                body: JSON.stringify({ messages })
              });
              
              clearTimeout(timeoutId);
              console.log('[OCR] Statement - Request completed successfully');
              break; // Success, exit retry loop
              
            } catch (fetchError: any) {
              clearTimeout(timeoutId);
              console.error('[OCR] Statement - External API fetch failed:', {
                name: fetchError.name,
                message: fetchError.message,
                code: fetchError.code
              });
              
              if (fetchError.name === 'AbortError') {
                throw new Error('Request timed out. The external AI service is taking too long to respond.');
              } else if (fetchError.message?.includes('fetch')) {
                throw new Error('Cannot connect to external AI service. Please check your internet connection or try again later.');
              } else {
                throw new Error(`External AI service error: ${fetchError.message}`);
              }
            }
            
          } catch (error: any) {
            console.error(`[OCR] Statement - Attempt ${retryCount + 1} failed:`, error.message);
            
            if (retryCount === maxRetries) {
              throw new Error(`Processing failed for ${file.name} after ${maxRetries + 1} attempts: ${error.message}`);
            }
            
            retryCount++;
            if (retryCount <= maxRetries) {
              const waitTime = Math.min(3000 * retryCount, 8000); // Progressive backoff
              console.log(`[OCR] Statement - Waiting ${waitTime}ms before retry`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }
        
        if (!response) {
          throw new Error(`Failed to get response from AI API for ${file.name}`);
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[OCR] AI API error response:', errorText);
          throw new Error(`AI API error for ${file.name}: ${response.status} - ${errorText}`);
        }

        const aiResult = await response.json();
        let extractedStatement: Partial<CruiseStatementData>;
        
        try {
          const cleanedResponse = cleanJsonResponse(aiResult.completion);
          extractedStatement = JSON.parse(cleanedResponse);
          delete (extractedStatement as any).guestNames;
        } catch (error) {
          console.error('[OCR] Failed to parse AI response as JSON:', error, aiResult.completion);
          throw new Error(`Failed to parse statement data from ${file.name}`);
        }

        // Find or create cruise based on extracted data first
        let targetCruiseId = input.cruiseId;
        
        if (!targetCruiseId && extractedStatement.ship && extractedStatement.departureDate) {
          // Try to find existing cruise that matches
          const matchingCruise = memoryStore.getCruises().find(cruise => 
            cruise.ship.toLowerCase().includes(extractedStatement.ship!.toLowerCase()) &&
            cruise.departureDate === extractedStatement.departureDate
          );
          
          if (matchingCruise) {
            console.log('[OCR] Found matching existing cruise for statement:', matchingCruise.id);
            targetCruiseId = matchingCruise.id;
          } else {
            // Create new cruise from statement data
            console.log('[OCR] Creating new cruise from statement data');
            const newCruise = memoryStore.createCruise({
              ship: extractedStatement.ship!,
              itineraryName: extractedStatement.itinerary || 'Unknown Itinerary',
              departurePort: 'Unknown Port',
              departureDate: extractedStatement.departureDate!,
              returnDate: extractedStatement.returnDate || extractedStatement.departureDate!,
              nights: extractedStatement.returnDate ? 
                Math.ceil((new Date(extractedStatement.returnDate).getTime() - new Date(extractedStatement.departureDate!).getTime()) / (1000 * 60 * 60 * 24)) : 7,
              line: 'Royal Caribbean', // Default, could be extracted from statement
              region: 'Unknown',
              stateroomTypes: [extractedStatement.cabinType || 'Interior'],
              status: 'on_sale' as const,
              // DO NOT set bookingId for past cruises with statements - they are completed, not booked
              // bookingId: undefined, // Past cruises should not appear as "booked"
              reservationNumber: extractedStatement.reservationNumber,
              cabinType: extractedStatement.cabinType
            });
            targetCruiseId = newCruise.id;
            console.log('[OCR] Created new cruise from statement:', targetCruiseId);
          }
        }
        
        if (!targetCruiseId) {
          throw new Error('Could not determine cruise for statement. Please provide cruise ID or ensure statement contains ship name and departure date.');
        }

        const sourceMeta = parseSourceInfo(input.files, i);

        // Create statement record
        const statement: CruiseStatementData = {
          id: `statement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          cruiseId: targetCruiseId,
          reservationNumber: extractedStatement.reservationNumber,
          statementDate: extractedStatement.statementDate,

          cabinNumber: extractedStatement.cabinNumber,
          cabinType: extractedStatement.cabinType,
          ship: extractedStatement.ship,
          itinerary: extractedStatement.itinerary,
          departureDate: extractedStatement.departureDate,
          returnDate: extractedStatement.returnDate,
          ports: extractedStatement.ports,
          
          cruiseFare: extractedStatement.cruiseFare,
          taxesAndFees: extractedStatement.taxesAndFees,
          gratuities: extractedStatement.gratuities,
          onboardCharges: extractedStatement.onboardCharges,
          excursions: extractedStatement.excursions,
          beveragePackages: extractedStatement.beveragePackages,
          internetPackages: extractedStatement.internetPackages,
          specialtyDining: extractedStatement.specialtyDining,
          photos: extractedStatement.photos,
          spa: extractedStatement.spa,
          casino: extractedStatement.casino,
          shopping: extractedStatement.shopping,
          otherCharges: extractedStatement.otherCharges,
          totalCharges: extractedStatement.totalCharges,
          
          deposits: extractedStatement.deposits,
          finalPayment: extractedStatement.finalPayment,
          onboardPayments: extractedStatement.onboardPayments,
          totalPayments: extractedStatement.totalPayments,
          balanceDue: extractedStatement.balanceDue,
          
          accountNumber: extractedStatement.accountNumber,
          folio: extractedStatement.folio,
          
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Store statement data using memory store with enhanced Club Royale data and line items
        const storedStatement = memoryStore.createCruiseStatement({
          cruiseId: targetCruiseId,
          fileName: file.name,
          fileType: file.type,
          ...extractedStatement,
          // Ensure clubRoyaleEntertainmentCharges is properly stored
          clubRoyaleEntertainmentCharges: extractedStatement.clubRoyaleEntertainmentCharges || extractedStatement.casino || 0,
          // Store line items for detailed analysis
          lineItems: (extractedStatement as any).lineItems || [],
          // Source metadata
          sourceFileBaseName: sourceMeta.sourceFileBaseName,
          sourcePageNumber: sourceMeta.sourcePageNumber,
          sourceTotalPages: sourceMeta.sourceTotalPages
        });

        // Automatically populate financials database from statement line items
        const lineItems = (extractedStatement as any).lineItems || [];
        if (lineItems.length > 0) {
          const financialRecords = lineItems.map((item: any) => {
            // Determine transaction type based on amount
            const isCredit = item.amount < 0;
            const txnType = isCredit ? 'Credit' : 'Charge';
            
            // Normalize department based on category/description
            let department: 'Casino' | 'Beverage' | 'Dining' | 'Spa' | 'Retail' | 'ShoreEx' | 'ServiceFees' | 'Taxes' | 'Gratuities' | 'Other' = 'Other';
            const desc = (item.description || item.category || '').toUpperCase();
            if (desc.includes('CASINO') || desc.includes('CLUB ROYALE') || desc.includes('GAMING')) department = 'Casino';
            else if (desc.includes('BAR') || desc.includes('BEVERAGE') || desc.includes('DRINK')) department = 'Beverage';
            else if (desc.includes('DINING') || desc.includes('RESTAURANT') || desc.includes('IZUMI') || desc.includes('CHEF')) department = 'Dining';
            else if (desc.includes('SPA') || desc.includes('SALON')) department = 'Spa';
            else if (desc.includes('SHOP') || desc.includes('RETAIL') || desc.includes('SOLERA')) department = 'Retail';
            else if (desc.includes('SHORE') || desc.includes('EXCURSION')) department = 'ShoreEx';
            else if (desc.includes('GRATUITY') || desc.includes('GRATUITIES')) department = 'Gratuities';
            else if (desc.includes('TAX') || desc.includes('FEE')) department = 'Taxes';
            else if (desc.includes('SERVICE')) department = 'ServiceFees';
            
            return {
              cruiseId: targetCruiseId,
              shipName: extractedStatement.ship,
              sailDateStart: extractedStatement.departureDate,
              sailDateEnd: extractedStatement.returnDate,
              itineraryName: extractedStatement.itinerary,
              cabinNumber: extractedStatement.cabinNumber,
              reservationNumber: extractedStatement.reservationNumber,
              sourceType: 'statement' as const,
              sourceFileBaseName: sourceMeta.sourceFileBaseName || file.name,
              sourcePageNumber: sourceMeta.sourcePageNumber,
              sourceTotalPages: sourceMeta.sourceTotalPages,
              processedAt: new Date().toISOString(),
              verified: true,
              statementId: storedStatement.id,
              postDate: item.date,
              txnType: txnType as 'Charge' | 'Credit' | 'Adjustment',
              description: item.description,
              department,
              amount: Math.abs(item.amount),
              category: item.category as any,
              folioNumber: extractedStatement.folio,
            };
          });
          
          memoryStore.addFinancials(financialRecords);
          console.log(`[OCR] Added ${financialRecords.length} statement line items to financials database`);
        }

        processedStatements.push(statement);
        
        // Store the targetCruiseId for later use
        if (!processedStatements[0]) {
          (processedStatements as any).targetCruiseId = targetCruiseId;
        }
        console.log(`[OCR] Successfully processed statement: ${file.name}`);
      }

      // Update the associated cruise with statement data if available
      const targetCruiseId = processedStatements[0]?.cruiseId;
      const cruise = targetCruiseId ? memoryStore.getCruise(targetCruiseId) : null;
      if (cruise && processedStatements.length > 0) {
        cruise.updatedAt = new Date().toISOString();
        // Could add statement references to cruise
      }

      console.log(`[OCR] Added ${processedStatements.length} cruise statements for cruise ${targetCruiseId || 'multiple cruises'}`);
      
      return {
        success: true,
        statements: processedStatements,
        processedCount: processedStatements.length,
        message: `Successfully processed ${processedStatements.length} cruise statement(s)`,
        cruiseId: targetCruiseId,
        cruiseCreated: !input.cruiseId && processedStatements.length > 0 // Indicates if we created a new cruise
      };
      
    } catch (error) {
      console.error('[OCR] Cruise statement processing error:', error);
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });