import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { memoryStore } from "../../_stores/memory";
import { CasinoOffer } from "../../../../../types/models";

const ocrCasinoOverviewSchema = z.object({
  imageBase64: z.string().optional(),
  images: z.array(z.string()).optional(),
}).refine(data => data.imageBase64 || (data.images && data.images.length > 0), {
  message: "Either imageBase64 or images array must be provided"
});

export const ocrCasinoOverviewProcedure = protectedProcedure
  .input(ocrCasinoOverviewSchema)
  .mutation(async ({ input }: { input: { imageBase64?: string; images?: string[] } }) => {
    console.log('[OCR] Processing casino overview OCR');
    
    try {
      // Validate input and determine processing mode
      const imagesToProcess = input.images || (input.imageBase64 ? [input.imageBase64] : []);
      
      if (imagesToProcess.length === 0) {
        throw new Error('No image data provided');
      }
      
      console.log(`[OCR] Processing ${imagesToProcess.length} casino overview image(s)`);

      console.log('[OCR] Calling AI API for casino overview extraction');
      
      // Call AI API to extract casino offer data with improved error handling
      let response: Response | null = null;
      const timeoutMs = 120000; // 120 seconds timeout for batch processing
      
      try {
        console.log(`[OCR] Calling AI API with ${timeoutMs/1000}s timeout`);
        
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log('[OCR] Request timeout reached, aborting...');
          controller.abort();
        }, timeoutMs);
        
        try {
          const apiUrl = 'https://toolkit.rork.com/text/llm/';
          console.log('[OCR] Attempting to connect to external AI API:', apiUrl);
          
          // First, test connectivity with a simple HEAD request
          try {
            const testController = new AbortController();
            const testTimeoutId = setTimeout(() => testController.abort(), 5000);
            
            const testResponse = await fetch(apiUrl, {
              method: 'HEAD',
              signal: testController.signal
            });
            
            clearTimeout(testTimeoutId);
            console.log('[OCR] Connectivity test result:', testResponse.status);
          } catch (testError) {
            console.error('[OCR] Connectivity test failed:', testError);
            throw new Error('🔌 AI Service Connection Failed\n\nCannot connect to the external AI service. This could be due to:\n• Service maintenance or temporary outage\n• Network connectivity issues\n• Internet connection problems\n\nPlease try again in a few minutes or use XLSX upload instead (which works without AI service).');
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
                  content: `You are a precise OCR system for casino offer overview flyers. Extract ALL casino offer information from the image and return it as a JSON array of offer objects. Each offer should have:
                {
                  "name": "Offer Name",
                  "rewardNumber": "Reward/Member Number if shown",
                  "offerName": "Specific offer title",
                  "offerType": "Type of offer (Free Play, Cruise Credit, etc.)",
                  "expires": "YYYY-MM-DD expiration date",
                  "offerCode": "Offer code if shown",
                  "tradeInValue": "Dollar value or description"
                }
                
                Be extremely precise with dates - convert any date format to YYYY-MM-DD. Extract ALL offers shown. Return only valid JSON array, no other text.`
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: imagesToProcess.length === 1 
                        ? 'Extract all casino offer data from this overview flyer image:'
                        : `Extract all casino offer data from these ${imagesToProcess.length} overview flyer images. Combine all offers from all images into a single JSON array:`
                    },
                    ...imagesToProcess.map(imageBase64 => ({
                      type: 'image' as const,
                      image: imageBase64
                    }))
                  ]
                }
              ]
            })
          });
          
          clearTimeout(timeoutId);
          console.log('[OCR] Request completed successfully');
          
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          console.error('[OCR] External API fetch failed:', {
            name: fetchError.name,
            message: fetchError.message,
            code: fetchError.code
          });
          
          // Provide specific error messages based on error type
          if (fetchError.name === 'AbortError') {
            throw new Error('AI service request timed out. The service may be overloaded. Please try again with fewer images or wait a moment.');
          } else if (fetchError.message?.includes('Failed to fetch') || fetchError.code === 'ENOTFOUND' || fetchError.code === 'ECONNREFUSED' || fetchError.name === 'TypeError') {
            throw new Error('🔌 AI Service Connection Failed\n\nThe external AI service is currently unavailable. This could be due to:\n• Service maintenance or temporary outage\n• Network connectivity issues\n• Internet connection problems\n• Firewall blocking the connection\n\nPlease try again in a few minutes or use XLSX upload instead (which doesn\'t require the AI service).');
          } else {
            throw new Error(`AI service error: ${fetchError.message}\n\nPlease try again or contact support if the issue persists.`);
          }
        }
        
      } catch (error: any) {
        console.error('[OCR] AI API call failed:', error);
        throw error; // Re-throw to be handled by outer catch
      }
      
      if (!response) {
        throw new Error('Failed to get response from AI service');
      }

      console.log('[OCR] AI API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OCR] AI API error response:', errorText);
        throw new Error(`AI API error: ${response.status} - ${errorText}`);
      }

      const aiResult = await response.json();
      console.log('[OCR] AI API response received, completion length:', aiResult.completion?.length || 0);
      
      if (!aiResult.completion) {
        throw new Error('No completion received from AI API');
      }

      let extractedOffers: Partial<CasinoOffer>[];
      
      try {
        console.log('[OCR] Parsing AI response as JSON:', aiResult.completion.substring(0, 200) + '...');
        extractedOffers = JSON.parse(aiResult.completion);
        console.log('[OCR] Successfully parsed', extractedOffers.length, 'offers from AI response');
      } catch (parseError) {
        console.error('[OCR] Failed to parse AI response as JSON:', aiResult.completion);
        console.error('[OCR] Parse error:', parseError);
        throw new Error('Failed to parse casino offer data from image - AI response was not valid JSON');
      }

      if (!Array.isArray(extractedOffers)) {
        console.error('[OCR] AI response is not an array:', extractedOffers);
        throw new Error('AI response is not a valid array of offers');
      }

      // Process and add offers to memory store
      const addedOffers: CasinoOffer[] = [];
      const errors: string[] = [];
      const duplicates: string[] = [];
      
      // Get existing offers to check for duplicates
      const existingOffers = memoryStore.getCasinoOffers();

      for (let i = 0; i < extractedOffers.length; i++) {
        const offerData = extractedOffers[i];
        
        try {
          // Validate required fields
          if (!offerData.name || !offerData.offerName) {
            errors.push(`Row ${i + 1}: Missing required fields (name, offerName)`);
            continue;
          }

          // Check for duplicates based on offer name and expiration date
          const isDuplicate = existingOffers.some(existing => 
            existing.offerName === offerData.offerName &&
            existing.expires === offerData.expires &&
            existing.offerCode === offerData.offerCode
          );
          
          if (isDuplicate) {
            duplicates.push(`${offerData.offerName} (expires: ${offerData.expires})`);
            continue;
          }

          const offer: CasinoOffer = {
            id: `casino_offer_${Date.now()}_${i}`,
            name: offerData.name,
            rewardNumber: offerData.rewardNumber || '',
            offerName: offerData.offerName,
            offerType: offerData.offerType || 'Unknown',
            expires: offerData.expires || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 30 days
            offerCode: offerData.offerCode || '',
            tradeInValue: offerData.tradeInValue || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // Add to memory store using the proper method
          const createdOffer = memoryStore.createCasinoOffer(offer);
          addedOffers.push(createdOffer);
          
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      console.log(`[OCR] Added ${addedOffers.length} casino offers from ${imagesToProcess.length} overview image(s)`);
      console.log(`[OCR] Found ${duplicates.length} duplicates, ${errors.length} errors`);
      
      return {
        success: true,
        addedCount: addedOffers.length,
        newOffersCount: addedOffers.length,
        duplicatesCount: duplicates.length,
        totalExtracted: extractedOffers.length,
        errors,
        duplicates: duplicates.slice(0, 10), // Show first 10 duplicates
        offers: addedOffers
      };
      
    } catch (error) {
      console.error('[OCR] Casino overview processing error:', error);
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });