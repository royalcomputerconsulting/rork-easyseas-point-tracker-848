import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from "../../create-context";
import { ocrOfferFlyerProcedure } from "./offer-flyer/route";
import { ocrCasinoOverviewProcedure } from "./casino-overview/route";
import { ocrReceiptProcedure } from "./receipt/route";
import { ocrCruiseStatementProcedure } from "./cruise-statement/route";
import { pdfProcedure } from "./pdf/route";
import { batchReceiptsProcedure } from "./batch-receipts/route";
import { memoryStore } from '../_stores/memory';
import { Cruise } from '../../../../types/models';
import fs from 'fs';
import path from 'path';
import { promises as fsp } from 'fs';
import { fileURLToPath } from 'url';
import { Buffer } from 'buffer';

function locateDataRoot(): { dataRoot: string; receiptsDir: string; statementsDir: string } {
  const cwd = process.cwd();
  console.log('[OCR] locateDataRoot - current working directory:', cwd);
  
  // Try multiple possible locations for DATA directory
  const possiblePaths = [
    // Direct path to project root DATA directory
    path.resolve(cwd, 'DATA'),
    // Check if we're in a subdirectory and need to go up
    path.resolve(cwd, '..', 'DATA'),
    path.resolve(cwd, '..', '..', 'DATA'),
    path.resolve(cwd, '..', '..', '..', 'DATA'),
    // From module directory
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'DATA'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', 'DATA'),
    // Alternative paths
    path.resolve(process.env.PWD || cwd, 'DATA'),
    // Check assets/data as fallback
    path.resolve(cwd, 'assets', 'data'),
    // Try absolute path from root
    '/Users/joeyrios/Documents/GitHub/A2O/DATA',
  ];
  
  // Also check if files were copied to assets/data
  const assetsDataPath = path.resolve(cwd, 'assets', 'data');
  if (fs.existsSync(assetsDataPath)) {
    possiblePaths.unshift(assetsDataPath); // Add to beginning of array for priority
  }
  
  console.log('[OCR] Checking possible DATA directory locations:');
  
  for (const testDataDir of possiblePaths) {
    const receiptsDir = path.join(testDataDir, 'Receipts');
    const statementsDir = path.join(testDataDir, 'Statements');
    
    console.log(`[OCR] Testing: ${testDataDir}`);
    console.log(`  Receipts: ${receiptsDir} exists: ${fs.existsSync(receiptsDir)}`);
    console.log(`  Statements: ${statementsDir} exists: ${fs.existsSync(statementsDir)}`);
    
    if (fs.existsSync(receiptsDir) && fs.existsSync(statementsDir)) {
      // Count actual image files
      const receiptsFiles = fs.readdirSync(receiptsDir).filter(f => /\.(png|jpg|jpeg|webp|bmp|gif|tif|tiff)$/i.test(f));
      const statementsFiles = fs.readdirSync(statementsDir).filter(f => /\.(png|jpg|jpeg|webp|bmp|gif|tif|tiff)$/i.test(f));
      
      console.log(`[OCR] Found DATA directories at: ${testDataDir}`);
      console.log(`  Receipts files: ${receiptsFiles.length} (${receiptsFiles.slice(0, 3).join(', ')}${receiptsFiles.length > 3 ? '...' : ''})`);
      console.log(`  Statements files: ${statementsFiles.length} (${statementsFiles.slice(0, 3).join(', ')}${statementsFiles.length > 3 ? '...' : ''})`);
      
      return {
        dataRoot: testDataDir,
        receiptsDir,
        statementsDir,
      };
    }
  }
  
  // Fallback: try to find DATA directory by walking up from current module
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  let currentDir = moduleDir;
  
  console.log('[OCR] Fallback: walking up from module directory:', moduleDir);
  
  for (let i = 0; i < 10; i++) {
    const testDataDir = path.join(currentDir, 'DATA');
    const testReceiptsDir = path.join(testDataDir, 'Receipts');
    const testStatementsDir = path.join(testDataDir, 'Statements');
    
    console.log(`[OCR] Checking level ${i}: ${testDataDir}`);
    
    if (fs.existsSync(testReceiptsDir) && fs.existsSync(testStatementsDir)) {
      console.log('[OCR] Found DATA directories at:', testDataDir);
      return {
        dataRoot: testDataDir,
        receiptsDir: testReceiptsDir,
        statementsDir: testStatementsDir,
      };
    }
    
    const parent = path.resolve(currentDir, '..');
    if (parent === currentDir) break; // Reached filesystem root
    currentDir = parent;
  }
  
  console.warn('[OCR] Could not locate DATA/Receipts and DATA/Statements directories');
  
  // Return project root paths even if they don't exist (for error handling)
  const fallbackDataDir = path.resolve(process.cwd(), 'DATA');
  return {
    dataRoot: fallbackDataDir,
    receiptsDir: path.join(fallbackDataDir, 'Receipts'),
    statementsDir: path.join(fallbackDataDir, 'Statements'),
  };
}

async function listGithubDir(owner: string, repo: string, pathInRepo: string): Promise<string[]> {
  try {
    const cleanedPath = pathInRepo.replace(/^\/+|\/+$/g, '');
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanedPath}`;
    const resp = await fetch(apiUrl + `?ts=${Date.now()}` , {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'rork-app/1.0',
      },
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.warn('[OCR] GitHub list failed', { apiUrl, status: resp.status, text });
      return [] as string[];
    }
    const json = (await resp.json()) as Array<{ name?: string; type?: string }>;
    return json
      .filter((i) => i?.type === 'file' && typeof i?.name === 'string')
      .map((i) => i.name as string)
      .filter((n) => /\.(png|jpg|jpeg|webp|bmp|gif|tif|tiff)$/i.test(n))
      .sort((a, b) => a.localeCompare(b));
  } catch (e) {
    console.error('[OCR] listGithubDir error', e);
    return [] as string[];
  }
}

// Helper function to clean JSON response from AI (removes markdown code blocks)
function cleanJsonResponse(response: string): string {
  console.log('[OCR] Raw AI response:', response.substring(0, 200) + '...');
  
  // Handle null/undefined/empty responses
  if (!response || typeof response !== 'string') {
    console.warn('[OCR] Invalid response type:', typeof response);
    return '{}';
  }
  
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
  } else if (jsonStart === -1 || jsonEnd === -1) {
    // No valid JSON object found
    console.warn('[OCR] No valid JSON object found in response');
    return '{}';
  }
  
  // Remove any remaining markdown artifacts
  cleaned = cleaned.replace(/^\s*```[a-z]*\s*/gm, '').replace(/\s*```\s*$/gm, '');
  
  // Final validation - ensure it starts with { and ends with }
  cleaned = cleaned.trim();
  if (!cleaned.startsWith('{') || !cleaned.endsWith('}')) {
    console.warn('[OCR] Cleaned response does not look like valid JSON');
    return '{}';
  }
  
  console.log('[OCR] Cleaned response:', cleaned.substring(0, 200) + '...');
  return cleaned;
}

export const ocrRouter = createTRPCRouter({
  offerFlyer: ocrOfferFlyerProcedure,
  casinoOverview: ocrCasinoOverviewProcedure,
  receipt: ocrReceiptProcedure,
  cruiseStatement: ocrCruiseStatementProcedure,
  pdf: pdfProcedure,
  batchReceipts: batchReceiptsProcedure,
  
  debugFileSystem: protectedProcedure
    .query(async () => {
      const cwd = process.cwd();
      const moduleDir = path.dirname(fileURLToPath(import.meta.url));
      
      console.log('[DEBUG] Current working directory:', cwd);
      console.log('[DEBUG] Module directory:', moduleDir);
      
      // Check various possible DATA locations
      const testPaths = [
        path.resolve('/', 'DATA'), // Absolute /DATA path
        path.resolve('/', 'DATA', 'Receipts'),
        path.resolve('/', 'DATA', 'Statements'),
        path.resolve(cwd, 'DATA'),
        path.resolve(cwd, 'DATA', 'Receipts'),
        path.resolve(cwd, 'DATA', 'Statements'),
        path.resolve(moduleDir, '../../../../DATA'),
        path.resolve(moduleDir, '../../../../DATA', 'Receipts'),
        path.resolve(moduleDir, '../../../../DATA', 'Statements'),
        path.resolve(moduleDir, '../../../../../DATA'), // One level higher
        path.resolve(moduleDir, '../../../../../DATA', 'Receipts'),
        path.resolve(moduleDir, '../../../../../DATA', 'Statements'),
      ];
      
      const pathResults = testPaths.map(testPath => {
        try {
          const exists = fs.existsSync(testPath);
          let isDir = false;
          let files: string[] = [];
          
          if (exists) {
            const stats = fs.statSync(testPath);
            isDir = stats.isDirectory();
            
            if (isDir) {
              try {
                files = fs.readdirSync(testPath).slice(0, 5); // First 5 files
              } catch (e) {
                files = [`Error reading: ${e}`];
              }
            }
          }
          
          return {
            path: testPath,
            exists,
            isDirectory: isDir,
            files
          };
        } catch (error) {
          return {
            path: testPath,
            exists: false,
            isDirectory: false,
            files: [],
            error: String(error)
          };
        }
      });
      
      return {
        cwd,
        moduleDir,
        pathResults
      };
    }),

  listDataFolderFiles: protectedProcedure
    .query(async () => {
      try {
        const { dataRoot, receiptsDir, statementsDir } = locateDataRoot();
        console.log('[OCR] listDataFolderFiles using data root:', dataRoot, { receiptsDir, statementsDir });

        const safeReadDir = (dirPath: string) => {
          try {
            const files = fs.readdirSync(dirPath, { withFileTypes: true });
            const imageFiles = files
              .filter((d) => d.isFile())
              .map((d) => d.name)
              .filter((n) => /\.(png|jpg|jpeg|webp|bmp|gif|tif|tiff)$/i.test(n))
              .sort((a, b) => a.localeCompare(b));
            
            console.log(`[OCR] Found ${imageFiles.length} image files in ${dirPath}:`);
            console.log(`  First 10: ${imageFiles.slice(0, 10).join(', ')}`);
            if (imageFiles.length > 10) {
              console.log(`  ...and ${imageFiles.length - 10} more files`);
            }
            
            return imageFiles;
          } catch (err) {
            console.error('[OCR] listDataFolderFiles read error for', dirPath, err);
            return [] as string[];
          }
        };

        let receipts = safeReadDir(receiptsDir);
        let statements = safeReadDir(statementsDir);

        if ((receipts.length + statements.length) === 0) {
          console.log('[OCR] Local DATA empty. Falling back to GitHub contents API');
          // Try FINANCIALS first, then legacy paths
          let ghReceipts = await listGithubDir('royalcomputerconsulting', 'rork-projectz', 'DATA/FINANCIALS/Receipts');
          let ghStatements = await listGithubDir('royalcomputerconsulting', 'rork-projectz', 'DATA/FINANCIALS/Statements');
          if ((ghReceipts.length + ghStatements.length) === 0) {
            ghReceipts = await listGithubDir('royalcomputerconsulting', 'rork-projectz', 'DATA/Receipts');
            ghStatements = await listGithubDir('royalcomputerconsulting', 'rork-projectz', 'DATA/Statements');
          }
          receipts = ghReceipts;
          statements = ghStatements;
        }

        const total = receipts.length + statements.length;
        console.log(`[OCR] listDataFolderFiles -> receipts: ${receipts.length}, statements: ${statements.length}, total: ${total}`);

        return {
          success: true,
          receipts,
          statements,
          total,
          dataRoot,
          receiptsDir,
          statementsDir,
          source: (receiptsDir && statementsDir && total > 0 ? 'local-or-github' : 'github') as 'local-or-github' | 'github',
        } as const;
      } catch (error: any) {
        console.error('[OCR] listDataFolderFiles fatal error:', error);
        return { success: false, receipts: [] as string[], statements: [] as string[], total: 0 } as const;
      }
    }),

  batchProcessStatements: protectedProcedure
    .input(z.object({
      imageUrls: z.array(z.string())
    }))
    .mutation(async ({ input }) => {
      console.log(`[OCR] Batch processing ${input.imageUrls.length} statements from URLs`);
      
      const results = [];
      const errors = [];
      
      for (let i = 0; i < input.imageUrls.length; i++) {
        const url = input.imageUrls[i];
        console.log(`[OCR] Processing statement ${i + 1}/${input.imageUrls.length}: ${url}`);
        
        try {
          // Fetch image from URL and convert to base64
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          
          // Call AI API directly to extract statement data
          const aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [
                {
                  role: 'system',
                  content: `You are a precise OCR system for cruise account statements and folios. Extract ALL financial and booking information from the cruise statement and return it as a JSON object with these fields:
                  {
                    "reservationNumber": "Confirmation/reservation number",
                    "statementDate": "YYYY-MM-DD",
                    "guestNames": ["Guest 1", "Guest 2"],
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
                        "category": "GAMING|DINING|BEVERAGES|etc",
                        "description": "Line item description",
                        "amount": number
                      }
                    ]
                  }
                  
                  CRITICAL: For Royal Caribbean statements, look for ALL line items that contain "CLUB ROYALE ENTERTAINMENT GAMES" or similar casino/gaming charges. Sum ALL these individual charges to get the total "clubRoyaleEntertainmentCharges" value. Also extract all individual line items with their dates, categories, descriptions, and amounts.
                  
                  Be extremely precise with dates and numbers. Convert any date format to YYYY-MM-DD. Extract all financial details accurately including itemized charges. Return only valid JSON object, no other text.`
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Extract all financial and booking information from this cruise statement image:'
                    },
                    {
                      type: 'image',
                      image: base64
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
          const cleanedResponse = cleanJsonResponse(aiResult.completion);
          let extractedStatement;
          try {
            extractedStatement = JSON.parse(cleanedResponse);
          } catch (parseError: any) {
            console.error('[OCR] JSON parse error:', parseError);
            console.error('[OCR] Attempted to parse:', cleanedResponse);
            throw new Error(`Failed to parse AI response: ${parseError.message}`);
          }
          
          // Find or create cruise based on extracted data
          let targetCruiseId: string | undefined;
          
          let createdForStatement = false;
          if (extractedStatement.ship && extractedStatement.departureDate) {
            const matchingCruise = memoryStore.getCruises().find(cruise => 
              cruise.ship.toLowerCase().includes(extractedStatement.ship.toLowerCase()) &&
              cruise.departureDate === extractedStatement.departureDate
            );
            
            if (matchingCruise) {
              console.log('[OCR] Found matching existing cruise for statement:', matchingCruise.id);
              targetCruiseId = matchingCruise.id;
              createdForStatement = false;
            } else {
              console.log('[OCR] Creating new cruise from statement data');
              const newCruise = memoryStore.createCruise({
                ship: extractedStatement.ship,
                itineraryName: extractedStatement.itinerary || 'Unknown Itinerary',
                departurePort: 'Unknown Port',
                departureDate: extractedStatement.departureDate,
                returnDate: extractedStatement.returnDate || extractedStatement.departureDate,
                nights: extractedStatement.returnDate ? 
                  Math.ceil((new Date(extractedStatement.returnDate).getTime() - new Date(extractedStatement.departureDate).getTime()) / (1000 * 60 * 60 * 24)) : 7,
                line: 'Royal Caribbean',
                region: 'Unknown',
                stateroomTypes: [extractedStatement.cabinType || 'Interior'],
                status: 'on_sale' as const,
                bookingId: extractedStatement.reservationNumber,
                reservationNumber: extractedStatement.reservationNumber,
                cabinType: extractedStatement.cabinType
              });
              targetCruiseId = newCruise.id;
              console.log('[OCR] Created new cruise from statement:', targetCruiseId);
              createdForStatement = true;
            }
          }
          
          if (targetCruiseId) {
            // Store statement data using memory store
            memoryStore.createCruiseStatement({
              cruiseId: targetCruiseId,
              fileName: `statement_${i + 1}.jpg`,
              fileType: 'image',
              ...extractedStatement,
              clubRoyaleEntertainmentCharges: extractedStatement.clubRoyaleEntertainmentCharges || extractedStatement.casino || 0
            });
          }
          
          results.push({
            url,
            success: true,
            cruiseId: targetCruiseId,
            created: createdForStatement,
            extractedData: extractedStatement
          });
          
        } catch (error: any) {
          console.error(`[OCR] Error processing statement ${i + 1}:`, error);
          errors.push({
            url,
            error: error.message
          });
        }
      }
      
      console.log(`[OCR] Batch processing complete: ${results.length} successful, ${errors.length} errors`);
      
      return {
        success: true,
        processed: results.length,
        errors: errors.length,
        results,
        errorDetails: errors
      };
    }),
  
  getAllReceiptsAndStatements: protectedProcedure
    .query(() => {
      console.log('[OCR] Getting all receipts and statements data');
      
      const receipts = memoryStore.getReceipts();
      const statements = memoryStore.getCruiseStatements();
      
      console.log(`[OCR] Found ${receipts.length} receipts and ${statements.length} statements`);
      
      return {
        receipts,
        statements,
        totalCount: receipts.length + statements.length
      };
    }),
  
  processDataFolderFiles: protectedProcedure
    .input(z.object({
      fileData: z.array(z.object({
        fileName: z.string(),
        type: z.enum(['receipt', 'statement']),
        base64Data: z.string()
      }))
    }))
    .mutation(async ({ input }) => {
      console.log(`[OCR] Processing ${input.fileData.length} files from DATA folder`);
      
      const results = {
        receiptsProcessed: 0,
        statementsProcessed: 0,
        cruisesCreated: 0,
        cruisesLinked: 0,
        errors: [] as string[],
        processedFiles: [] as {fileName: string, type: string, success: boolean, cruiseId?: string, error?: string}[]
      };
      
      for (let i = 0; i < input.fileData.length; i++) {
        const file = input.fileData[i];
        console.log(`[OCR] Processing ${file.type} ${i + 1}/${input.fileData.length}: ${file.fileName}`);
        
        try {
          let extractedData: any;
          let aiResponse: Response;
          
          if (file.type === 'receipt') {
            aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messages: [
                  {
                    role: 'system',
                    content: `Extract cruise booking receipt data and return as JSON:\n{\n  "ship": "Ship name",\n  "departureDate": "YYYY-MM-DD",\n  "returnDate": "YYYY-MM-DD",\n  "nights": number,\n  "cabinNumber": "Cabin number",\n  "cabinType": "Interior|Oceanview|Balcony|Suite",\n  "retailPrice": number,\n  "casinoDiscount": number,\n  "amountPaid": number,\n  "freePlay": number,\n  "reservationNumber": "Confirmation number",\n  "guestNames": ["Guest 1", "Guest 2"],\n  "itinerary": "Itinerary description"\n}\nReturn only valid JSON.`
                  },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Extract receipt data from this cruise booking receipt:'
                      },
                      {
                        type: 'image',
                        image: file.base64Data
                      }
                    ]
                  }
                ]
              })
            });
          } else {
            aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messages: [
                  {
                    role: 'system',
                    content: `You are a precise OCR system for cruise account statements and folios. Extract ALL financial and booking information from the cruise statement and return it as a JSON object with these fields:\n{\n  "reservationNumber": "Confirmation/reservation number",\n  "statementDate": "YYYY-MM-DD",\n  "guestNames": ["Guest 1", "Guest 2"],\n  "cabinNumber": "Cabin number",\n  "cabinType": "Interior|Oceanview|Balcony|Suite",\n  "ship": "Ship name",\n  "itinerary": "Itinerary description",\n  "departureDate": "YYYY-MM-DD",\n  "returnDate": "YYYY-MM-DD",\n  "ports": ["Port 1", "Port 2"],\n  "cruiseFare": number,\n  "taxesAndFees": number,\n  "gratuities": number,\n  "onboardCharges": number,\n  "excursions": number,\n  "beveragePackages": number,\n  "internetPackages": number,\n  "specialtyDining": number,\n  "photos": number,\n  "spa": number,\n  "casino": number,\n  "shopping": number,\n  "otherCharges": number,\n  "totalCharges": number,\n  "deposits": number,\n  "finalPayment": number,\n  "onboardPayments": number,\n  "totalPayments": number,\n  "balanceDue": number,\n  "accountNumber": "Account number if shown",\n  "folio": "Folio number if shown",\n  "clubRoyaleEntertainmentCharges": number,\n  "lineItems": [\n    {\n      "date": "MM/DD",\n      "category": "GAMING|DINING|BEVERAGES|etc",\n      "description": "Line item description",\n      "amount": number\n    }\n  ]\n}\nReturn only valid JSON object, no other text.`
                  },
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Extract all financial and booking information from this cruise statement image:'
                      },
                      {
                        type: 'image',
                        image: file.base64Data
                      }
                    ]
                  }
                ]
              })
            });
          }
          
          if (!aiResponse.ok) {
            throw new Error(`AI API error: ${aiResponse.status}`);
          }
          
          const aiResult = await aiResponse.json();
          const cleanedResponse = cleanJsonResponse(aiResult.completion);
          try {
            extractedData = JSON.parse(cleanedResponse);
          } catch (parseError: any) {
            console.error('[OCR] JSON parse error:', parseError);
            console.error('[OCR] Attempted to parse:', cleanedResponse);
            throw new Error(`Failed to parse AI response: ${parseError.message}`);
          }
          
          let targetCruiseId: string | undefined;
          
          if (extractedData.ship && extractedData.departureDate) {
            const matchingCruise = memoryStore.getCruises().find(cruise => 
              cruise.ship.toLowerCase().includes(extractedData.ship.toLowerCase()) &&
              cruise.departureDate === extractedData.departureDate
            );
            
            if (matchingCruise) {
              console.log(`[OCR] Found matching cruise for ${file.type}:`, matchingCruise.id);
              targetCruiseId = matchingCruise.id;
              results.cruisesLinked++;
            } else {
              console.log(`[OCR] Creating new cruise from ${file.type} data`);
              const newCruise = memoryStore.createCruise({
                ship: extractedData.ship,
                itineraryName: extractedData.itinerary || 'Unknown Itinerary',
                departurePort: 'Unknown Port',
                departureDate: extractedData.departureDate,
                returnDate: extractedData.returnDate || extractedData.departureDate,
                nights: extractedData.nights || (extractedData.returnDate ? 
                  Math.ceil((new Date(extractedData.returnDate).getTime() - new Date(extractedData.departureDate).getTime()) / (1000 * 60 * 60 * 24)) : 7),
                line: 'Royal Caribbean',
                region: 'Unknown',
                stateroomTypes: [extractedData.cabinType || 'Interior'],
                status: 'on_sale' as const,
                bookingId: extractedData.reservationNumber,
                reservationNumber: extractedData.reservationNumber,
                cabinType: extractedData.cabinType
              });
              targetCruiseId = newCruise.id;
              results.cruisesCreated++;
            }
          }
          
          if (targetCruiseId) {
            if (file.type === 'receipt') {
              // Create receipt record
              const receipt = memoryStore.createReceipt({
                cruiseId: targetCruiseId,
                fileName: file.fileName,
                fileType: 'image',
                ...extractedData
              });
              
              // Add to financials database
              const financialRecord = {
                cruiseId: targetCruiseId,
                shipName: extractedData.ship,
                sailDateStart: extractedData.departureDate,
                sailDateEnd: extractedData.returnDate,
                itineraryName: extractedData.itinerary,
                cabinNumber: extractedData.cabinNumber,
                reservationNumber: extractedData.reservationNumber,
                sourceType: 'receipt' as const,
                sourceFileBaseName: file.fileName,
                processedAt: new Date().toISOString(),
                verified: true,
                receiptId: receipt.id,
                category: 'Other' as const,
                itemDescription: 'Cruise booking receipt',
                lineTotal: extractedData.retailPrice || extractedData.amountPaid || 0,
                discount: extractedData.casinoDiscount || 0,
                paymentMethod: 'Credit Card' as const,
                amount: extractedData.amountPaid || 0
              };
              
              memoryStore.addFinancials([financialRecord]);
              
              results.receiptsProcessed++;
            } else {
              // Create statement record
              const statement = memoryStore.createCruiseStatement({
                cruiseId: targetCruiseId,
                fileName: file.fileName,
                fileType: 'image',
                ...extractedData,
                clubRoyaleEntertainmentCharges: extractedData.clubRoyaleEntertainmentCharges || extractedData.casino || 0
              });
              
              // Add line items to financials database
              if (extractedData.lineItems && Array.isArray(extractedData.lineItems)) {
                const financialRecords = extractedData.lineItems.map((lineItem: any) => ({
                  cruiseId: targetCruiseId,
                  shipName: extractedData.ship,
                  sailDateStart: extractedData.departureDate,
                  sailDateEnd: extractedData.returnDate,
                  itineraryName: extractedData.itinerary,
                  cabinNumber: extractedData.cabinNumber,
                  reservationNumber: extractedData.reservationNumber,
                  sourceType: 'statement' as const,
                  sourceFileBaseName: file.fileName,
                  processedAt: new Date().toISOString(),
                  verified: true,
                  statementId: statement.id,
                  postDate: lineItem.date,
                  txnType: (lineItem.amount >= 0 ? 'Charge' : 'Credit'),
                  description: lineItem.description,
                  department: lineItem.category === 'GAMING' ? 'Casino' : 
                            lineItem.category === 'DINING' ? 'Dining' :
                            lineItem.category === 'BEVERAGES' ? 'Beverage' :
                            lineItem.category === 'SPA' ? 'Spa' :
                            lineItem.category === 'SERVICES' ? 'ServiceFees' :
                            'Other' as const,
                  amount: lineItem.amount,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  id: undefined as unknown as string
                }));
                
                memoryStore.addFinancials(financialRecords);
              }
              
              results.statementsProcessed++;
            }
          }
          
          results.processedFiles.push({
            fileName: file.fileName,
            type: file.type,
            success: true,
            cruiseId: targetCruiseId
          });
          
        } catch (error: any) {
          console.error(`[OCR] Error processing ${file.type} ${file.fileName}:`, error);
          results.errors.push(`${file.fileName}: ${error.message}`);
          results.processedFiles.push({
            fileName: file.fileName,
            type: file.type,
            success: false,
            error: error.message
          });
        }
      }
      
      console.log('[OCR] DATA folder processing complete:', results);
      
      return {
        success: true,
        message: `Processed ${results.receiptsProcessed} receipts and ${results.statementsProcessed} statements. Created ${results.cruisesCreated} new cruises, linked ${results.cruisesLinked} existing cruises.`,
        results
      };
    }),

  // New: Server-side rescan and process directly from DATA folders and refill Financials
  rescanAndProcessDataFolders: protectedProcedure
    .input(z.object({ resetFinancials: z.boolean().optional(), resetReceiptsStatements: z.boolean().optional() }).optional())
    .mutation(async ({ input }) => {
      console.log('[OCR] rescanAndProcessDataFolders called', input);
      const { dataRoot, receiptsDir, statementsDir } = locateDataRoot();
      console.log('[OCR] rescanAndProcessDataFolders using data root:', dataRoot, { receiptsDir, statementsDir });

      const readDir = (dirPath: string) => {
        try {
          const files = fs.readdirSync(dirPath, { withFileTypes: true });
          return files
            .filter((d) => d.isFile())
            .map((d) => d.name)
            .filter((n) => /\.(png|jpg|jpeg|webp|bmp|gif|tif|tiff)$/i.test(n))
            .sort((a, b) => a.localeCompare(b));
        } catch (err) {
          console.error('[OCR] readDir error for', dirPath, err);
          return [] as string[];
        }
      };

      if (input?.resetFinancials) {
        console.log('[OCR] Resetting financials array before refill');
        // Reset only financials
        (memoryStore as any).financials = [];
      }
      if (input?.resetReceiptsStatements) {
        console.log('[OCR] Resetting receipts/statements arrays');
        (memoryStore as any).receipts = [];
        (memoryStore as any).cruiseStatements = [];
      }

      let receipts = readDir(receiptsDir);
      let statements = readDir(statementsDir);

      if ((receipts.length + statements.length) === 0) {
        console.log('[OCR] No local files found, fetching from GitHub...');
        // Prefer FINANCIALS paths if present in repo
        let ghReceipts = await listGithubDir('royalcomputerconsulting', 'rork-projectz', 'DATA/FINANCIALS/Receipts');
        let ghStatements = await listGithubDir('royalcomputerconsulting', 'rork-projectz', 'DATA/FINANCIALS/Statements');
        if ((ghReceipts.length + ghStatements.length) === 0) {
          ghReceipts = await listGithubDir('royalcomputerconsulting', 'rork-projectz', 'DATA/Receipts');
          ghStatements = await listGithubDir('royalcomputerconsulting', 'rork-projectz', 'DATA/Statements');
        }
        receipts = ghReceipts;
        statements = ghStatements;
      }

      const total = receipts.length + statements.length;
      console.log(`[OCR] Found files - receipts: ${receipts.length}, statements: ${statements.length}, total: ${total}`);

      const results = {
        receiptsProcessed: 0,
        statementsProcessed: 0,
        cruisesCreated: 0,
        cruisesLinked: 0,
        errors: [] as string[],
        processedFiles: [] as {fileName: string, type: string, success: boolean, cruiseId?: string, error?: string}[]
      };

      const fromGithub = (p: string) => `https://raw.githubusercontent.com/royalcomputerconsulting/rork-projectz/main/${p}` as const;

      const fileEntries: Array<{ fullPath?: string; url?: string; fileName: string; type: 'receipt' | 'statement' }> = [
        ...receipts.map((f) => ({
          fullPath: fs.existsSync(path.join(receiptsDir, f)) ? path.join(receiptsDir, f) : undefined,
          url: fs.existsSync(path.join(receiptsDir, f)) ? undefined : (
            (receiptsDir.includes(`${path.sep}FINANCIALS${path.sep}`) || receiptsDir.includes(`${path.sep}FINANCIAL${path.sep}`))
              ? fromGithub(`DATA/FINANCIALS/Receipts/${f}`)
              : fromGithub(`DATA/Receipts/${f}`)
          ),
          fileName: f,
          type: 'receipt' as const,
        })),
        ...statements.map((f) => ({
          fullPath: fs.existsSync(path.join(statementsDir, f)) ? path.join(statementsDir, f) : undefined,
          url: fs.existsSync(path.join(statementsDir, f)) ? undefined : (
            (statementsDir.includes(`${path.sep}FINANCIALS${path.sep}`) || statementsDir.includes(`${path.sep}FINANCIAL${path.sep}`))
              ? fromGithub(`DATA/FINANCIALS/Statements/${f}`)
              : fromGithub(`DATA/Statements/${f}`)
          ),
          fileName: f,
          type: 'statement' as const,
        })),
      ];

      for (let i = 0; i < fileEntries.length; i++) {
        const entry = fileEntries[i];
        console.log(`[OCR] Processing ${entry.type} ${i + 1}/${fileEntries.length}: ${entry.fileName}`);
        try {
          let base64Data: string;
          if (entry.fullPath) {
            const buf = await fsp.readFile(entry.fullPath);
            base64Data = buf.toString('base64');
          } else if (entry.url) {
            const resp = await fetch(entry.url);
            if (!resp.ok) throw new Error(`Failed to fetch image from GitHub: ${resp.status}`);
            const arr = await resp.arrayBuffer();
            base64Data = Buffer.from(arr).toString('base64');
          } else {
            throw new Error('Invalid file entry (no path or url)');
          }

          let extractedData: any;
          let aiResponse: Response;
          if (entry.type === 'receipt') {
            aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [
                  { role: 'system', content: `Extract cruise booking receipt data and return as JSON:\n{\n  "ship": "Ship name",\n  "departureDate": "YYYY-MM-DD",\n  "returnDate": "YYYY-MM-DD",\n  "nights": number,\n  "cabinNumber": "Cabin number",\n  "cabinType": "Interior|Oceanview|Balcony|Suite",\n  "retailPrice": number,\n  "casinoDiscount": number,\n  "amountPaid": number,\n  "freePlay": number,\n  "reservationNumber": "Confirmation number",\n  "guestNames": ["Guest 1", "Guest 2"],\n  "itinerary": "Itinerary description"\n}\nReturn only valid JSON.` },
                  { role: 'user', content: [ { type: 'text', text: 'Extract receipt data from this cruise booking receipt:' }, { type: 'image', image: base64Data } ] }
                ]
              })
            });
          } else {
            aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [
                  { role: 'system', content: `You are a precise OCR system for cruise account statements and folios. Extract ALL financial and booking information from the cruise statement and return it as a JSON object with these fields:\n{\n  "reservationNumber": "Confirmation/reservation number",\n  "statementDate": "YYYY-MM-DD",\n  "guestNames": ["Guest 1", "Guest 2"],\n  "cabinNumber": "Cabin number",\n  "cabinType": "Interior|Oceanview|Balcony|Suite",\n  "ship": "Ship name",\n  "itinerary": "Itinerary description",\n  "departureDate": "YYYY-MM-DD",\n  "returnDate": "YYYY-MM-DD",\n  "ports": ["Port 1", "Port 2"],\n  "cruiseFare": number,\n  "taxesAndFees": number,\n  "gratuities": number,\n  "onboardCharges": number,\n  "excursions": number,\n  "beveragePackages": number,\n  "internetPackages": number,\n  "specialtyDining": number,\n  "photos": number,\n  "spa": number,\n  "casino": number,\n  "shopping": number,\n  "otherCharges": number,\n  "totalCharges": number,\n  "deposits": number,\n  "finalPayment": number,\n  "onboardPayments": number,\n  "totalPayments": number,\n  "balanceDue": number,\n  "accountNumber": "Account number if shown",\n  "folio": "Folio number if shown",\n  "clubRoyaleEntertainmentCharges": number,\n  "lineItems": [ { "date": "MM/DD", "category": "GAMING|DINING|BEVERAGES|etc", "description": "Line item description", "amount": number } ]\n}\nReturn only valid JSON object, no other text.` },
                  { role: 'user', content: [ { type: 'text', text: 'Extract all financial and booking information from this cruise statement image:' }, { type: 'image', image: base64Data } ] }
                ]
              })
            });
          }

          if (!aiResponse.ok) throw new Error(`AI API error: ${aiResponse.status}`);
          const aiResult = await aiResponse.json();
          const cleanedResponse = cleanJsonResponse(aiResult.completion);
          try {
            extractedData = JSON.parse(cleanedResponse);
          } catch (parseError: any) {
            console.error('[OCR] JSON parse error:', parseError);
            console.error('[OCR] Attempted to parse:', cleanedResponse);
            throw new Error(`Failed to parse AI response: ${parseError.message}`);
          }

          let targetCruiseId: string | undefined;
          if (extractedData.ship && extractedData.departureDate) {
            const matchingCruise = memoryStore.getCruises().find(cruise => cruise.ship.toLowerCase().includes(extractedData.ship.toLowerCase()) && cruise.departureDate === extractedData.departureDate);
            if (matchingCruise) {
              targetCruiseId = matchingCruise.id;
              results.cruisesLinked++;
            } else {
              const newCruise = memoryStore.createCruise({
                ship: extractedData.ship,
                itineraryName: extractedData.itinerary || 'Unknown Itinerary',
                departurePort: 'Unknown Port',
                departureDate: extractedData.departureDate,
                returnDate: extractedData.returnDate || extractedData.departureDate,
                nights: extractedData.nights || (extractedData.returnDate ? Math.ceil((new Date(extractedData.returnDate).getTime() - new Date(extractedData.departureDate).getTime()) / (1000*60*60*24)) : 7),
                line: 'Royal Caribbean',
                region: 'Unknown',
                stateroomTypes: [extractedData.cabinType || 'Interior'],
                status: 'on_sale' as const,
                bookingId: extractedData.reservationNumber,
                reservationNumber: extractedData.reservationNumber,
                cabinType: extractedData.cabinType
              });
              targetCruiseId = newCruise.id;
              results.cruisesCreated++;
            }
          }

          if (targetCruiseId) {
            if (entry.type === 'receipt') {
              memoryStore.createReceipt({ cruiseId: targetCruiseId, fileName: entry.fileName, fileType: 'image', ...extractedData });
              results.receiptsProcessed++;
            } else {
              memoryStore.createCruiseStatement({ cruiseId: targetCruiseId, fileName: entry.fileName, fileType: 'image', ...extractedData, clubRoyaleEntertainmentCharges: extractedData.clubRoyaleEntertainmentCharges || extractedData.casino || 0 });
              results.statementsProcessed++;
            }
          }

          results.processedFiles.push({ fileName: entry.fileName, type: entry.type, success: true, cruiseId: targetCruiseId });
        } catch (err: any) {
          console.error('[OCR] Failed processing', entry.fileName, err);
          results.errors.push(`${entry.fileName}: ${err?.message ?? 'Unknown error'}`);
          results.processedFiles.push({ fileName: entry.fileName, type: entry.type, success: false, error: err?.message ?? 'Unknown error' });
        }
      }

      console.log('[OCR] Server-side DATA folders processing complete', results);
      return { success: true as const, scanned: total, ...results };
    }),
  
  confirmOfferFlyer: protectedProcedure
    .input(z.object({
      cruises: z.array(z.any()) // Array of cruise objects to add
    }))
    .mutation(({ input }) => {
      console.log(`[OCR] Confirming addition of ${input.cruises.length} cruises`);
      
      const addedCruises: Cruise[] = [];
      
      for (const cruiseData of input.cruises) {
        try {
          const cruise = memoryStore.createCruise(cruiseData);
          addedCruises.push(cruise);
        } catch (error) {
          console.error('[OCR] Error adding cruise:', error);
        }
      }
      
      console.log(`[OCR] Successfully added ${addedCruises.length} cruises to database`);
      
      return {
        success: true,
        addedCount: addedCruises.length,
        message: `Successfully added ${addedCruises.length} new cruises to the database!`
      };
    }),

  // Get accurate count of all files that need processing
  getUnprocessedFileCount: protectedProcedure
    .query(async () => {
      try {
        const { dataRoot, receiptsDir, statementsDir } = locateDataRoot();
        console.log('[OCR] getUnprocessedFileCount using data root:', dataRoot);

        const safeReadDir = (dirPath: string) => {
          try {
            const files = fs.readdirSync(dirPath, { withFileTypes: true });
            return files
              .filter((d) => d.isFile())
              .map((d) => d.name)
              .filter((n) => /\.(png|jpg|jpeg|webp|bmp|gif|tif|tiff)$/i.test(n))
              .sort((a, b) => a.localeCompare(b));
          } catch (err) {
            console.error('[OCR] getUnprocessedFileCount read error for', dirPath, err);
            return [] as string[];
          }
        };

        let receipts = safeReadDir(receiptsDir);
        let statements = safeReadDir(statementsDir);

        // If no local files, try GitHub
        if ((receipts.length + statements.length) === 0) {
          console.log('[OCR] No local files, checking GitHub...');
          let ghReceipts = await listGithubDir('royalcomputerconsulting', 'rork-projectz', 'DATA/FINANCIALS/Receipts');
          let ghStatements = await listGithubDir('royalcomputerconsulting', 'rork-projectz', 'DATA/FINANCIALS/Statements');
          if ((ghReceipts.length + ghStatements.length) === 0) {
            ghReceipts = await listGithubDir('royalcomputerconsulting', 'rork-projectz', 'DATA/Receipts');
            ghStatements = await listGithubDir('royalcomputerconsulting', 'rork-projectz', 'DATA/Statements');
          }
          receipts = ghReceipts;
          statements = ghStatements;
        }

        const totalFiles = receipts.length + statements.length;
        const processedReceipts = memoryStore.getReceipts().length;
        const processedStatements = memoryStore.getCruiseStatements().length;
        const totalProcessed = processedReceipts + processedStatements;
        const unprocessedCount = Math.max(0, totalFiles - totalProcessed);

        console.log(`[OCR] File count analysis:`);
        console.log(`  Total files found: ${totalFiles} (${receipts.length} receipts, ${statements.length} statements)`);
        console.log(`  Already processed: ${totalProcessed} (${processedReceipts} receipts, ${processedStatements} statements)`);
        console.log(`  Unprocessed: ${unprocessedCount}`);

        return {
          success: true,
          totalFiles,
          receiptsFound: receipts.length,
          statementsFound: statements.length,
          processedReceipts,
          processedStatements,
          totalProcessed,
          unprocessedCount,
          needsProcessing: unprocessedCount > 0,
          dataSource: receipts.length > 0 || statements.length > 0 ? 'local' : 'github',
          dataRoot,
          receiptsDir,
          statementsDir
        };
      } catch (error: any) {
        console.error('[OCR] getUnprocessedFileCount error:', error);
        return {
          success: false,
          error: error.message,
          totalFiles: 0,
          receiptsFound: 0,
          statementsFound: 0,
          processedReceipts: 0,
          processedStatements: 0,
          totalProcessed: 0,
          unprocessedCount: 0,
          needsProcessing: false
        };
      }
    }),

  // Process and populate financials database directly from DATA folder
  copyDataFilesToAssets: protectedProcedure
    .mutation(async () => {
      console.log('[OCR] Processing DATA files and populating financials database');
      
      const { dataRoot, receiptsDir, statementsDir } = locateDataRoot();
      console.log('[OCR] Source directories:', { dataRoot, receiptsDir, statementsDir });
      
      // Check if directories exist
      if (!fs.existsSync(receiptsDir) || !fs.existsSync(statementsDir)) {
        console.error('[OCR] DATA directories not found:', { receiptsDir, statementsDir });
        return {
          success: false,
          message: `DATA directories not found. Looking for:\nReceipts: ${receiptsDir}\nStatements: ${statementsDir}`,
          error: 'Directories not found'
        };
      }
      
      try {
        // Read files from DATA directories
        const receiptFiles = fs.readdirSync(receiptsDir).filter(f => /\.(png|jpg|jpeg|webp|bmp|gif|tif|tiff)$/i.test(f));
        const statementFiles = fs.readdirSync(statementsDir).filter(f => /\.(png|jpg|jpeg|webp|bmp|gif|tif|tiff)$/i.test(f));
        
        console.log(`[OCR] Found ${receiptFiles.length} receipts and ${statementFiles.length} statements`);
        
        // Process files and populate financials database
        let processedFiles = 0;
        let errors: string[] = [];
        
        // Clear existing financials data for fresh import
        console.log('[OCR] Clearing existing financials data for fresh import');
        (memoryStore as any).financials = [];
        
        // Process each receipt
        for (const fileName of receiptFiles) {
          try {
            const filePath = path.join(receiptsDir, fileName);
            const fileBuffer = await fsp.readFile(filePath);
            const base64Data = fileBuffer.toString('base64');
            
            console.log(`[OCR] Processing receipt: ${fileName}`);
            
            // Call AI API to extract data
            const aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [
                  { 
                    role: 'system', 
                    content: `Extract cruise booking receipt data and return as JSON:\n{\n  "ship": "Ship name",\n  "departureDate": "YYYY-MM-DD",\n  "returnDate": "YYYY-MM-DD",\n  "nights": number,\n  "cabinNumber": "Cabin number",\n  "cabinType": "Interior|Oceanview|Balcony|Suite",\n  "retailPrice": number,\n  "casinoDiscount": number,\n  "amountPaid": number,\n  "freePlay": number,\n  "reservationNumber": "Confirmation number",\n  "guestNames": ["Guest 1", "Guest 2"],\n  "itinerary": "Itinerary description"\n}\nReturn only valid JSON.` 
                  },
                  { 
                    role: 'user', 
                    content: [
                      { type: 'text', text: 'Extract receipt data from this cruise booking receipt:' },
                      { type: 'image', image: base64Data }
                    ] 
                  }
                ]
              })
            });
            
            if (aiResponse.ok) {
              const aiResult = await aiResponse.json();
              const extractedData = JSON.parse(cleanJsonResponse(aiResult.completion));
              
              // Add to financials database
              const financialRecord = {
                id: `fin-receipt-${Date.now()}-${Math.random()}`,
                cruiseId: `cruise-${extractedData.ship}-${extractedData.departureDate}`,
                shipName: extractedData.ship,
                sailDateStart: extractedData.departureDate,
                sailDateEnd: extractedData.returnDate,
                itineraryName: extractedData.itinerary,
                cabinNumber: extractedData.cabinNumber,
                reservationNumber: extractedData.reservationNumber,
                sourceType: 'receipt' as const,
                sourceFileBaseName: fileName,
                processedAt: new Date().toISOString(),
                verified: true,
                category: 'Other' as const,
                itemDescription: 'Cruise booking',
                lineTotal: extractedData.retailPrice || 0,
                discount: extractedData.casinoDiscount || 0,
                amount: extractedData.amountPaid || 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              
              memoryStore.addFinancials([financialRecord]);
              processedFiles++;
            }
          } catch (error: any) {
            errors.push(`Receipt ${fileName}: ${error.message}`);
            console.error(`[OCR] Error processing receipt ${fileName}:`, error);
          }
        }
        
        // Process each statement
        for (const fileName of statementFiles) {
          try {
            const filePath = path.join(statementsDir, fileName);
            const fileBuffer = await fsp.readFile(filePath);
            const base64Data = fileBuffer.toString('base64');
            
            console.log(`[OCR] Processing statement: ${fileName}`);
            
            // Call AI API to extract data
            const aiResponse = await fetch('https://toolkit.rork.com/text/llm/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [
                  { 
                    role: 'system', 
                    content: `Extract cruise statement data including line items. Return as JSON with lineItems array containing all charges.` 
                  },
                  { 
                    role: 'user', 
                    content: [
                      { type: 'text', text: 'Extract all data from this cruise statement:' },
                      { type: 'image', image: base64Data }
                    ] 
                  }
                ]
              })
            });
            
            if (aiResponse.ok) {
              const aiResult = await aiResponse.json();
              const extractedData = JSON.parse(cleanJsonResponse(aiResult.completion));
              
              // Add summary record
              const summaryRecord = {
                id: `fin-stmt-${Date.now()}-${Math.random()}`,
                cruiseId: `cruise-${extractedData.ship}-${extractedData.departureDate}`,
                shipName: extractedData.ship,
                sailDateStart: extractedData.departureDate,
                sailDateEnd: extractedData.returnDate,
                itineraryName: extractedData.itinerary,
                cabinNumber: extractedData.cabinNumber,
                reservationNumber: extractedData.reservationNumber,
                sourceType: 'statement' as const,
                sourceFileBaseName: fileName,
                processedAt: new Date().toISOString(),
                verified: true,
                category: 'Other' as const,
                itemDescription: 'Statement total',
                amount: extractedData.totalCharges || 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              
              memoryStore.addFinancials([summaryRecord]);
              processedFiles++;
            }
          } catch (error: any) {
            errors.push(`Statement ${fileName}: ${error.message}`);
            console.error(`[OCR] Error processing statement ${fileName}:`, error);
          }
        }
        
        console.log(`[OCR] Processing complete: ${processedFiles} files processed, ${errors.length} errors`);
        
        return {
          success: true,
          copiedFiles: processedFiles,
          errors,
          assetsDataDir: dataRoot,
          message: `Successfully processed ${processedFiles} files and populated financials database. ${errors.length} errors occurred.`
        };
        
      } catch (error: any) {
        console.error('[OCR] Error during processing:', error);
        return {
          success: false,
          error: error.message,
          message: `Failed to process files: ${error.message}`
        };
      }
    }),
});