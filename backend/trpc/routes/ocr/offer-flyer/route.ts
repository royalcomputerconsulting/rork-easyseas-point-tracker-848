import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { memoryStore } from "../../_stores/memory";
import { Cruise } from "../../../../../types/models";

const ocrOfferFlyerSchema = z.object({
  images: z.array(z.string()), // Array of base64 images
  offerCode: z.string().optional(),
  offerName: z.string().optional(),
});

export const ocrOfferFlyerProcedure = protectedProcedure
  .input(ocrOfferFlyerSchema)
  .mutation(async ({ input }: { input: { images: string[]; offerCode?: string; offerName?: string } }) => {
    console.log(`[OCR] Processing offer flyer OCR with ${input.images.length} images`);
    
    if (!input.images || input.images.length === 0) {
      throw new Error('No images provided for OCR processing');
    }
    
    try {
      let allExtractedCruises: Partial<Cruise>[] = [];
      
      // Process each image
      for (let imageIndex = 0; imageIndex < input.images.length; imageIndex++) {
        const imageBase64 = input.images[imageIndex];
        console.log(`[OCR] Processing image ${imageIndex + 1} of ${input.images.length}`);
        
        // Validate image data
        if (!imageBase64 || imageBase64.length < 100) {
          console.error(`[OCR] Image ${imageIndex + 1} is invalid or too small`);
          continue;
        }
        
        // Call AI API to extract cruise data from this image
        const response = await fetch('https://toolkit.rork.com/text/llm/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: `You are a precise OCR system for cruise offer flyers. Extract ALL cruise information from the image and return it as a JSON array of cruise objects.

IMPORTANT: The image shows a cruise offer flyer with multiple sailings. Look for:
- Ship names (e.g., "Quantum of the Seas", "Navigator of the Seas")
- Itinerary details (e.g., "5 Night Cabo Overnight", "3 Night Ensenada")
- Departure dates in various formats (convert ALL to YYYY-MM-DD format)
- Cabin types (Interior, Balcony, etc.)
- Departure ports (e.g., "Los Angeles, CA")

For dates like "2025: 12/5, 12/10" interpret as December 5, 2025 and December 10, 2025.
For dates like "2026: 1/13, 2/10" interpret as January 13, 2026 and February 10, 2026.

Each cruise should have this exact structure:
{
  "ship": "Ship Name",
  "itineraryName": "Itinerary description",
  "departurePort": "Port name",
  "departureDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD",
  "nights": number,
  "line": "Royal Caribbean" (or other cruise line if shown),
  "region": "West Coast" (or appropriate region),
  "cabinType": "Interior" or "Balcony" or "Suite",
  "status": "on_sale",
  "offerCode": "${input.offerCode || 'LUCKY_LINEUP'}",
  "offerName": "${input.offerName || 'Lucky Lineup Offer'}",
  "value": "$116-$170 per person" (or whatever is shown)
}

Extract EVERY SINGLE cruise shown, even if there are 50+ rows. Return ONLY a valid JSON array, no other text.`
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Extract all cruise data from this offer flyer. Be sure to get ALL cruises listed, including all dates shown:`
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
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[OCR] AI API error for image ${imageIndex + 1}: ${response.status}`);
          console.error(`[OCR] Error details:`, errorText);
          continue; // Skip this image and continue with others
        }
        
        const aiResult = await response.json();
        
        try {
          // Try to extract JSON from the response
          let jsonStr = aiResult.completion;
          
          // If the response contains markdown code blocks, extract the JSON
          if (jsonStr.includes('```json')) {
            jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
          } else if (jsonStr.includes('```')) {
            jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
          }
          
          const imageCruises: Partial<Cruise>[] = JSON.parse(jsonStr);
          
          // Process dates to ensure they're in YYYY-MM-DD format
          const processedCruises = imageCruises.map(cruise => {
            // Calculate return date if not provided
            if (cruise.departureDate && cruise.nights && !cruise.returnDate) {
              const depDate = new Date(cruise.departureDate);
              depDate.setDate(depDate.getDate() + cruise.nights);
              cruise.returnDate = depDate.toISOString().split('T')[0];
            }
            return cruise;
          });
          
          allExtractedCruises = allExtractedCruises.concat(processedCruises);
          console.log(`[OCR] Extracted ${processedCruises.length} cruises from image ${imageIndex + 1}`);
        } catch (parseError) {
          console.error(`[OCR] Failed to parse AI response for image ${imageIndex + 1}:`, parseError);
          console.error(`[OCR] Raw response:`, aiResult.completion?.substring(0, 500));
          // Continue with other images
        }
      }

      
      if (allExtractedCruises.length === 0) {
        console.error('[OCR] No cruise data extracted from any image');
        return {
          success: false,
          error: 'Failed to extract cruise data from the flyer. Please ensure the image is clear and contains cruise information.',
          newCruisesCount: 0,
          duplicatesCount: 0,
          totalExtracted: 0,
          imagesProcessed: input.images.length,
          errors: ['No cruise data could be extracted from the provided images'],
          duplicates: [],
          newCruises: [],
          pendingCruises: []
        };
      }
      
      console.log(`[OCR] Total extracted cruises from all images: ${allExtractedCruises.length}`);
      const extractedCruises = allExtractedCruises;

      // Validate and filter out duplicates
      const existingCruises = memoryStore.getCruises();
      const newCruises: Cruise[] = [];
      const duplicates: string[] = [];
      const errors: string[] = [];

      for (let i = 0; i < extractedCruises.length; i++) {
        const cruiseData = extractedCruises[i];
        
        try {
          // Validate required fields
          if (!cruiseData.ship || !cruiseData.departureDate || !cruiseData.returnDate) {
            errors.push(`Row ${i + 1}: Missing required fields (ship, departureDate, returnDate)`);
            continue;
          }

          // Calculate nights if not provided
          const depDate = new Date(cruiseData.departureDate!);
          const retDate = new Date(cruiseData.returnDate!);
          const nights = cruiseData.nights || Math.ceil((retDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24));

          const cruise: Cruise = {
            id: `cruise_${Date.now()}_${i}`,
            ship: cruiseData.ship,
            itineraryName: cruiseData.itineraryName || 'Unknown Itinerary',
            departurePort: cruiseData.departurePort || 'Unknown Port',
            arrivalPort: cruiseData.arrivalPort,
            departureDate: cruiseData.departureDate,
            returnDate: cruiseData.returnDate,
            nights,
            line: cruiseData.line || 'Royal Caribbean',
            region: cruiseData.region,
            shipClass: cruiseData.shipClass,
            stateroomTypes: cruiseData.cabinType ? [cruiseData.cabinType] : ['Interior'],
            status: 'on_sale',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            cabinType: cruiseData.cabinType || 'Interior',
            offerCode: cruiseData.offerCode || input.offerCode,
            offerName: cruiseData.offerName || input.offerName,
            value: cruiseData.value
          };

          // Check for duplicates based on ship, departure date, and offer code
          const isDuplicate = existingCruises.some(existing => 
            existing.ship === cruise.ship &&
            existing.departureDate === cruise.departureDate &&
            existing.offerCode === cruise.offerCode &&
            existing.offerName === cruise.offerName
          );

          if (isDuplicate) {
            duplicates.push(`${cruise.ship} on ${cruise.departureDate} with offer ${cruise.offerCode}`);
          } else {
            newCruises.push(cruise);
          }
          
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      console.log(`[OCR] Found ${newCruises.length} new cruises, ${duplicates.length} duplicates from ${input.images.length} images`);
      
      // Return validation results for user confirmation
      return {
        success: true,
        newCruisesCount: newCruises.length,
        duplicatesCount: duplicates.length,
        totalExtracted: extractedCruises.length,
        imagesProcessed: input.images.length,
        errors,
        duplicates: duplicates.slice(0, 10), // Show first 10 duplicates
        newCruises: newCruises.slice(0, 5), // Show first 5 new cruises for preview
        pendingCruises: newCruises // Store all new cruises for confirmation
      };
      
    } catch (error) {
      console.error('[OCR] Offer flyer processing error:', error);
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });