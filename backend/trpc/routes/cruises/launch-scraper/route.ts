import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync, readdir } from 'fs';
import { promisify } from 'util';
import { memoryStore } from '../../_stores/memory';

const readdirAsync = promisify(readdir);

// Interface for tracking scraper sessions
interface ScraperSession {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  pid?: number;
  progress: {
    currentOffer: number;
    totalOffers: number;
    currentOfferName?: string;
  };
  results: {
    offersProcessed: number;
    cruisesFound: number;
    cruisesAdded: number;
    errors: string[];
    filesGenerated: string[];
  };
}

// In-memory session storage
const scraperSessions = new Map<string, ScraperSession>();

// Helper function to parse Excel files and convert to cruise format
async function parseAndImportExcelFile(filePath: string): Promise<{ cruisesAdded: number; cruisesFound: number; errors: string[] }> {
  try {
    console.log(`[LaunchScraper] 📊 Parsing Excel file: ${filePath}`);
    
    // Check if file exists
    if (!existsSync(filePath)) {
      console.log(`[LaunchScraper] ⚠️ File not found: ${filePath}`);
      return { cruisesAdded: 0, cruisesFound: 0, errors: [`File not found: ${filePath}`] };
    }
    
    // Read and parse Excel file
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`[LaunchScraper] 📄 Found ${data.length} rows in Excel file`);
    
    let cruisesAdded = 0;
    const errors: string[] = [];
    
    // Process each row and convert to cruise format
    for (const row of data) {
      try {
        // Map Excel columns to cruise data
        const sailingDate = row['Sailing Date'] || row['sailingDate'] || '';
        const shipName = row['Ship Name'] || row['shipName'] || '';
        const departurePort = row['Departure Port'] || row['departurePort'] || '';
        const itinerary = row['Itinerary'] || row['itinerary'] || '';
        const nights = parseInt(String(row['Nights'] || row['nights'] || '7'));
        const cabinType = row['Cabin Type'] || row['cabinType'] || 'Interior';
        const numberOfGuests = String(row['# of Guests'] || row['numberOfGuests'] || '2');
        const offerName = row['Offer Name'] || row['offerName'] || '';
        const offerCode = row['Offer Code'] || row['offerCode'] || '';
        const offerExpireDate = row['OFFER EXPIRE DATE'] || row['offerExpireDate'] || '';
        
        // Skip empty rows
        if (!sailingDate || !shipName) {
          continue;
        }
        
        // Calculate return date
        const departureDate = new Date(sailingDate);
        const returnDate = new Date(departureDate);
        returnDate.setDate(returnDate.getDate() + nights);
        
        // Create cruise object
        const cruise = {
          ship: shipName,
          line: 'Royal Caribbean International',
          departureDate: departureDate.toISOString().split('T')[0],
          returnDate: returnDate.toISOString().split('T')[0],
          nights: nights,
          itineraryName: itinerary,
          departurePort: departurePort,
          stateroomTypes: [cabinType],
          maxGuests: parseInt(numberOfGuests) || 2,
          status: 'on_sale' as const,
          source: 'royal-caribbean-python-scraper',
          clubRoyaleOffer: {
            offerName: offerName,
            offerCode: offerCode,
            expirationDate: offerExpireDate,
            cabinType: cabinType,
            guestCount: numberOfGuests
          }
        };
        
        // Check if cruise already exists
        const existingCruise = memoryStore.getCruises().find(c => 
          c.ship === cruise.ship && 
          c.departureDate === cruise.departureDate &&
          c.itineraryName === cruise.itineraryName
        );
        
        if (!existingCruise) {
          memoryStore.createCruise(cruise);
          cruisesAdded++;
          console.log(`[LaunchScraper] ✅ Added new cruise: ${cruise.ship} - ${cruise.departureDate}`);
        } else {
          // Update existing cruise with offer details
          const updatedCruise = {
            ...existingCruise,
            clubRoyaleOffer: cruise.clubRoyaleOffer,
            source: 'royal-caribbean-python-scraper',
            updatedAt: new Date().toISOString()
          };
          memoryStore.updateCruise(existingCruise.id, updatedCruise);
          console.log(`[LaunchScraper] 🔄 Updated existing cruise: ${cruise.ship} - ${cruise.departureDate}`);
        }
        
      } catch (rowError) {
        console.error(`[LaunchScraper] Error processing row:`, rowError);
        errors.push(`Failed to process row: ${rowError}`);
      }
    }
    
    console.log(`[LaunchScraper] ✅ Successfully processed ${cruisesAdded} cruises from ${filePath}`);
    return { cruisesAdded, cruisesFound: data.length, errors };
    
  } catch (error) {
    console.error(`[LaunchScraper] ❌ Error parsing Excel file ${filePath}:`, error);
    return { cruisesAdded: 0, cruisesFound: 0, errors: [`Failed to parse Excel file: ${error}`] };
  }
}

// Monitor for new Excel files and process them
async function monitorAndProcessFiles(sessionId: string) {
  const session = scraperSessions.get(sessionId);
  if (!session) return;
  
  const dataPath = join(process.cwd(), 'DATA');
  
  try {
    const files = await readdirAsync(dataPath);
    const excelFiles = files.filter(file => 
      (file.startsWith('Offer_') && file.endsWith('.xlsx')) ||
      file === 'ClubRoyale_AllOffers_Merged.xlsx'
    );
    
    console.log(`[LaunchScraper] 📁 Found ${excelFiles.length} Excel files to process`);
    
    let totalCruisesAdded = 0;
    let totalCruisesFound = 0;
    const allErrors: string[] = [];
    
    for (const fileName of excelFiles) {
      // Skip if already processed
      if (session.results.filesGenerated.includes(fileName)) {
        continue;
      }
      
      const filePath = join(dataPath, fileName);
      const result = await parseAndImportExcelFile(filePath);
      
      totalCruisesAdded += result.cruisesAdded;
      totalCruisesFound += result.cruisesFound;
      allErrors.push(...result.errors);
      
      session.results.filesGenerated.push(fileName);
    }
    
    // Update session results
    session.results.cruisesAdded += totalCruisesAdded;
    session.results.cruisesFound += totalCruisesFound;
    session.results.errors.push(...allErrors);
    
    console.log(`[LaunchScraper] 📊 Processed ${excelFiles.length} files, added ${totalCruisesAdded} cruises`);
    
  } catch (error) {
    console.error(`[LaunchScraper] Error monitoring files:`, error);
    session.results.errors.push(`File monitoring error: ${error}`);
  }
}

export const launchScraperProcedure = publicProcedure
  .input(z.object({
    maxOffers: z.number().default(9),
    loginWaitSeconds: z.number().default(180)
  }))
  .mutation(async ({ input }) => {
    try {
      console.log('[LaunchScraper] 🚀 Starting Royal Caribbean Python scraper...');
      
      // Create session ID
      const sessionId = `scraper-${Date.now()}`;
      
      // Path to the scraper directory
      const scraperDir = join(process.cwd(), 'DATA', 'SCRAPER', 'src');
      const mainPyPath = join(scraperDir, 'main.py');
      const dataPath = join(process.cwd(), 'DATA');
      
      // Check if the scraper files exist
      if (!existsSync(mainPyPath)) {
        throw new Error(`Scraper not found at ${mainPyPath}. Please ensure the scraper files are in DATA/SCRAPER/src/`);
      }
      
      console.log(`[LaunchScraper] 📂 Found scraper at: ${mainPyPath}`);
      console.log(`[LaunchScraper] 💾 Data will be saved to: ${dataPath}`);
      
      // Create session tracking
      const session: ScraperSession = {
        id: sessionId,
        status: 'running',
        startTime: new Date().toISOString(),
        progress: {
          currentOffer: 0,
          totalOffers: input.maxOffers
        },
        results: {
          offersProcessed: 0,
          cruisesFound: 0,
          cruisesAdded: 0,
          errors: [],
          filesGenerated: []
        }
      };
      
      scraperSessions.set(sessionId, session);
      
      // Launch the Python scraper with proper environment variables
      const pythonProcess = spawn('python3', [mainPyPath], {
        cwd: scraperDir,
        env: {
          ...process.env,
          MAX_OFFERS: input.maxOffers.toString(),
          LOGIN_WAIT_SECONDS: input.loginWaitSeconds.toString(),
          DOWNLOADS: dataPath // Save files directly to DATA folder
        },
        stdio: ['pipe', 'pipe', 'pipe'] // Capture output
      });
      
      session.pid = pythonProcess.pid;
      
      // Handle Python process output
      pythonProcess.stdout.on('data', (data) => {
        const text = data.toString();
        console.log('[LaunchScraper] 🐍 Python:', text.trim());
        
        // Parse progress from output
        const progressMatch = text.match(/\[(\d+)\/(\d+)\]/);
        if (progressMatch) {
          session.progress.currentOffer = parseInt(progressMatch[1]);
          session.progress.totalOffers = parseInt(progressMatch[2]);
        }
        
        // Extract current offer name
        const offerMatch = text.match(/\[(\d+)\/(\d+)\]\s+(.+?)\s+\(/);
        if (offerMatch) {
          session.progress.currentOfferName = offerMatch[3];
        }
      });
      
      pythonProcess.stderr.on('data', (data) => {
        const text = data.toString();
        console.error('[LaunchScraper] 🚨 Python error:', text.trim());
        session.results.errors.push(text.trim());
      });
      
      // Handle process completion
      pythonProcess.on('close', async (code) => {
        console.log(`[LaunchScraper] 🏁 Python scraper finished with code: ${code}`);
        
        if (code === 0) {
          session.status = 'completed';
          console.log('[LaunchScraper] ✅ Scraper completed successfully, processing files...');
          
          // Process generated Excel files
          await monitorAndProcessFiles(sessionId);
          
          console.log(`[LaunchScraper] 🎉 Processing complete! Added ${session.results.cruisesAdded} cruises from ${session.results.filesGenerated.length} files`);
        } else {
          session.status = 'failed';
          session.results.errors.push(`Scraper failed with exit code ${code}`);
          console.log(`[LaunchScraper] ❌ Scraper failed with code ${code}`);
        }
        
        session.endTime = new Date().toISOString();
      });
      
      pythonProcess.on('error', (err) => {
        console.error('[LaunchScraper] 💥 Failed to start scraper:', err);
        session.status = 'failed';
        session.endTime = new Date().toISOString();
        session.results.errors.push(`Failed to start scraper: ${err.message}`);
      });
      
      // Set up file monitoring (check every 10 seconds for new files)
      const fileMonitor = setInterval(async () => {
        if (session.status === 'running') {
          await monitorAndProcessFiles(sessionId);
        } else {
          clearInterval(fileMonitor);
        }
      }, 10000);
      
      // Set timeout (15 minutes)
      setTimeout(() => {
        if (session.status === 'running') {
          pythonProcess.kill();
          session.status = 'failed';
          session.endTime = new Date().toISOString();
          session.results.errors.push('Scraper timed out after 15 minutes');
          console.log('[LaunchScraper] ⏰ Scraper timed out');
          clearInterval(fileMonitor);
        }
      }, 15 * 60 * 1000);
      
      console.log(`[LaunchScraper] 🚀 Python scraper launched with PID: ${pythonProcess.pid}`);
      
      return {
        success: true,
        sessionId: sessionId,
        message: 'Royal Caribbean scraper launched successfully! A Chromium browser window will open for you to log in. The scraper will automatically extract all Club Royale offers and save them as Excel files, which will be automatically imported into your cruise database.',
        pid: pythonProcess.pid,
        instructions: [
          '1. A Chromium browser window will open shortly',
          '2. Log into your Royal Caribbean account',
          '3. Navigate to Club Royale offers (or wait for auto-redirect)',
          '4. The scraper will automatically process all visible offers',
          '5. Excel files will be saved to DATA folder and imported automatically',
          '6. Monitor progress in the Royal Caribbean Scraper screen'
        ],
        estimatedDuration: '5-15 minutes (depending on login time)',
        maxOffers: input.maxOffers
      };
    } catch (error: any) {
      console.error('[LaunchScraper] Failed to launch scraper:', error);
      
      // Provide helpful error messages
      let errorMessage = error.message;
      if (error.code === 'ENOENT') {
        errorMessage = 'Python not found. Please ensure Python is installed and available in your PATH.';
      }
      
      return {
        success: false,
        message: errorMessage,
        error: error.message
      };
    }
  });

// Get scraper session status
export const getScraperStatusProcedure = publicProcedure
  .input(z.object({
    sessionId: z.string()
  }))
  .query(({ input }) => {
    console.log('[LaunchScraper] Getting status for session:', input.sessionId);
    
    const session = scraperSessions.get(input.sessionId);
    
    if (!session) {
      return {
        found: false,
        error: 'Session not found'
      };
    }
    
    return {
      found: true,
      session: {
        id: session.id,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        pid: session.pid,
        progress: session.progress,
        results: session.results,
        duration: session.endTime ? 
          Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000) : 
          Math.round((new Date().getTime() - new Date(session.startTime).getTime()) / 1000)
      }
    };
  });

// List all scraper sessions
export const listScraperSessionsProcedure = publicProcedure
  .query(() => {
    console.log('[LaunchScraper] Listing all scraper sessions');
    
    const sessions = Array.from(scraperSessions.values())
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 10); // Return last 10 sessions
    
    return {
      sessions: sessions.map(session => ({
        id: session.id,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        pid: session.pid,
        results: session.results,
        duration: session.endTime ? 
          Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000) : 
          Math.round((new Date().getTime() - new Date(session.startTime).getTime()) / 1000)
      })),
      total: scraperSessions.size
    };
  });

// Cancel scraper session
export const cancelScraperSessionProcedure = publicProcedure
  .input(z.object({
    sessionId: z.string()
  }))
  .mutation(({ input }) => {
    console.log('[LaunchScraper] Cancelling session:', input.sessionId);
    
    const session = scraperSessions.get(input.sessionId);
    
    if (!session) {
      return {
        success: false,
        error: 'Session not found'
      };
    }
    
    if (session.status === 'completed' || session.status === 'failed') {
      return {
        success: false,
        error: 'Session already finished'
      };
    }
    
    session.status = 'cancelled';
    session.endTime = new Date().toISOString();
    
    // Try to kill the process if it exists
    if (session.pid) {
      try {
        process.kill(session.pid);
        console.log(`[LaunchScraper] Killed process ${session.pid}`);
      } catch (error) {
        console.log(`[LaunchScraper] Could not kill process ${session.pid}:`, error);
      }
    }
    
    return {
      success: true,
      message: 'Scraper session cancelled'
    };
  });