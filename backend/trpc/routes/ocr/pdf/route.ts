import { z } from 'zod';
import { protectedProcedure } from '@/backend/trpc/create-context';

const pdfSchema = z.object({
  base64: z.string(),
  type: z.enum(['offer-flyer', 'casino-overview', 'receipt']),
  offerCode: z.string().optional(),
  offerName: z.string().optional(),
  fileName: z.string().optional(),
});

// Helper function to process an image with OCR
async function processImageWithOCR(
  imageBase64: string,
  type: string,
  offerCode?: string,
  offerName?: string
): Promise<any[]> {
  let systemPrompt = '';
  let userPrompt = '';
  
  if (type === 'offer-flyer') {
    systemPrompt = `You are an expert at extracting cruise data from document images.
    
This is a cruise fare document with tabular data.

Extract ALL rows you can see and return as JSON array with structure:
{
  "offerCode": "string",
  "ship": "string",
  "departurePort": "string",
  "departureDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD (calculate from departureDate + nights)",
  "itineraryName": "string",
  "cabinType": "string",
  "offerType": "string",
  "nextCruiseBonus": "string",
  "nights": number,
  "line": "Royal Caribbean"
}

IMPORTANT:
- Extract EVERY row visible
- Calculate returnDate as departureDate + nights
- Return ONLY valid JSON array
- Process as many rows as possible within the response limit`;
    
    userPrompt = `Extract ALL cruise data rows from this image. Return JSON array only. Focus on extracting as many complete rows as possible.`;
  } else if (type === 'casino-overview') {
    systemPrompt = `Extract casino offers from this image. Return JSON array with: offerCode, offerName, offerType, expires, tradeInValue, description.`;
    userPrompt = `Extract all casino offers from this image. Return JSON array only.`;
  } else {
    systemPrompt = `Extract booking receipt data from this image. Return JSON array with: reservationNumber, ship, departureDate, returnDate, cabinType, paidFare, actualFare, guestName.`;
    userPrompt = `Extract all booking data from this image. Return JSON array only.`;
  }
  
  const body = {
    messages: [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image', image: imageBase64 }
        ]
      },
    ],
  };
  
  const response = await fetch('https://toolkit.rork.com/text/llm/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000) // 2 minute timeout
  });
  
  if (!response.ok) {
    throw new Error(`AI processing failed: ${response.status}`);
  }
  
  const result = await response.json();
  const text = result?.completion ?? '[]';
  
  // Extract JSON array
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const safeText = jsonMatch ? jsonMatch[0] : '[]';
  
  let rows: any[] = [];
  try {
    rows = JSON.parse(safeText);
  } catch (e) {
    console.error('[OCR-PDF] Failed to parse JSON, attempting recovery...');
    // Try to extract individual objects
    const objectMatches = text.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
    for (const match of objectMatches) {
      try {
        const obj = JSON.parse(match[0]);
        if (obj && typeof obj === 'object') {
          rows.push(obj);
        }
      } catch (err) {
        // Skip invalid objects
      }
    }
  }
  
  // Process and clean data
  if (type === 'offer-flyer') {
    rows = rows.map(row => {
      // Parse dates
      if (row.departureDate || row.sailDate) {
        const dateStr = row.departureDate || row.sailDate;
        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            row.departureDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          // Keep original
        }
      }
      
      // Calculate return date if not present
      if (row.departureDate && row.nights && !row.returnDate) {
        try {
          const depDate = new Date(row.departureDate);
          const retDate = new Date(depDate);
          retDate.setDate(retDate.getDate() + parseInt(row.nights));
          row.returnDate = retDate.toISOString().split('T')[0];
        } catch (e) {
          // Skip if calculation fails
        }
      }
      
      // Extract nights from itinerary if not present
      if (!row.nights && row.itineraryName) {
        const nightsMatch = row.itineraryName.match(/(\d+)\s*Night/i);
        if (nightsMatch) {
          row.nights = parseInt(nightsMatch[1]);
        }
      }
      
      // Add offer info
      if (offerCode) row.offerCode = offerCode;
      if (offerName) row.offerName = offerName;
      
      return row;
    });
  }
  
  return rows;
}

export const pdfProcedure = protectedProcedure
  .input(pdfSchema)
  .mutation(async ({ input }) => {
    console.log(`[OCR-PDF] Processing PDF: ${input.fileName || 'unnamed.pdf'}, type: ${input.type}`);
    console.log(`[OCR-PDF] Base64 length: ${input.base64?.length || 0} characters`);
    
    try {
      // Check if base64 is valid
      if (!input.base64 || input.base64.length === 0) {
        throw new Error('No PDF data provided');
      }
      
      // For PDF processing, we need to treat the PDF base64 as an image
      // The LLM API can handle PDF data directly when sent as image data
      console.log('[OCR-PDF] Processing PDF as image data...');
      
      let rows: any[] = [];
      
      try {
        // Process the PDF directly as image data
        rows = await processImageWithOCR(input.base64, input.type, input.offerCode, input.offerName);
        console.log(`[OCR-PDF] Successfully extracted ${rows.length} rows from PDF`);
      } catch (error) {
        console.error('[OCR-PDF] Direct processing failed, trying alternative approach:', error);
        
        // If direct processing fails, try to use the image edit API to convert PDF to image
        try {
          console.log('[OCR-PDF] Attempting PDF to image conversion...');
          const convertResponse = await fetch('https://toolkit.rork.com/images/edit/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: 'Convert this PDF document to a high-quality image with clear, readable text and tables. Maintain all formatting and ensure text is legible.',
              images: [{ type: 'image', image: input.base64 }]
            })
          });
          
          if (convertResponse.ok) {
            const convertResult = await convertResponse.json();
            if (convertResult.image?.base64Data) {
              console.log('[OCR-PDF] Successfully converted PDF to image, processing...');
              rows = await processImageWithOCR(convertResult.image.base64Data, input.type, input.offerCode, input.offerName);
              console.log(`[OCR-PDF] Extracted ${rows.length} rows from converted image`);
            } else {
              throw new Error('PDF conversion returned no image data');
            }
          } else {
            throw new Error(`PDF conversion failed: ${convertResponse.status}`);
          }
        } catch (conversionError) {
          console.error('[OCR-PDF] PDF conversion also failed:', conversionError);
          throw new Error(`Cannot process PDF file: ${input.fileName || 'document'}. Please try converting to images first or use a different format.`);
        }
      }
      
      return {
        success: true,
        totalExtracted: rows.length,
        rows: rows,
        message: `Successfully extracted ${rows.length} rows from PDF`
      };
      
    } catch (error) {
      console.error('[OCR-PDF] Processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process PDF';
      
      // Provide more helpful error messages
      if (errorMessage.includes('timeout')) {
        return {
          success: false,
          totalExtracted: 0,
          rows: [],
          error: 'PDF processing timed out. Please try with a smaller file or convert to images first.'
        };
      } else if (errorMessage.includes('413') || errorMessage.includes('payload too large')) {
        return {
          success: false,
          totalExtracted: 0,
          rows: [],
          error: 'PDF file is too large. Please split it into smaller files or convert to images.'
        };
      } else if (errorMessage.includes('rate limit')) {
        return {
          success: false,
          totalExtracted: 0,
          rows: [],
          error: 'Rate limit reached. Please wait a moment and try again.'
        };
      }
      
      return {
        success: false,
        totalExtracted: 0,
        rows: [],
        error: errorMessage
      };
    }
  });