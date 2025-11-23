

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const API_KEY = "AIzaSyDRw4PGTqGmAQ8bDgPiRCVunvMbW7q5baE"; // Public API key for read-only access

export function parseGoogleSheetUrl(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export async function fetchSheetData(sheetId: string) {
  console.log("Fetching sheet data for ID:", sheetId);
  
  try {
    // First, try to get the sheet metadata to see what sheets are available
    const metadataUrl = `${SHEETS_API_BASE}/${sheetId}?key=${API_KEY}`;
    console.log('Fetching sheet metadata from:', metadataUrl);
    
    const metadataResponse = await fetch(metadataUrl);
    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error('Metadata fetch failed:', metadataResponse.status, errorText);
      throw new Error(`Failed to access Google Sheets. Status: ${metadataResponse.status}. Please ensure the sheet is publicly accessible (Anyone with the link can view).`);
    }
    
    const metadata = await metadataResponse.json();
    console.log('Available sheets:', metadata.sheets?.map((s: any) => s.properties.title));
    
    // Try to fetch data directly from each expected sheet
    const sheetData: Record<string, any> = {};
    const expectedSheets = [
      { name: 'CRUISES', key: 'cruises' },
      { name: 'BOOKED CRUISES', key: 'booked' },
      { name: 'CASINO OVERVIEW OFFERS', key: 'offers' }, // Updated name
      { name: 'TRIPIT CALENDAR ICS', key: 'calendar' } // Updated name
    ];
    
    for (const sheet of expectedSheets) {
      const range = `${sheet.name}!A:Z`;
      const dataUrl = `${SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
      
      try {
        console.log(`Fetching ${sheet.name} data from:`, dataUrl);
        const dataResponse = await fetch(dataUrl);
        if (dataResponse.ok) {
          const data = await dataResponse.json();
          sheetData[sheet.key] = data.values || [];
          console.log(`${sheet.name}: ${data.values?.length || 0} rows`);
        } else {
          const errorText = await dataResponse.text();
          console.warn(`Failed to fetch ${sheet.name}: ${dataResponse.status}`, errorText);
          sheetData[sheet.key] = [];
        }
      } catch (error) {
        console.error(`Error fetching ${sheet.name}:`, error);
        sheetData[sheet.key] = [];
      }
    }
    
    // Check if we got any data
    const totalRows = Object.values(sheetData).reduce((sum, arr) => sum + (arr as any[]).length, 0);
    console.log('Total rows fetched:', totalRows);
    
    if (totalRows === 0) {
      throw new Error('No data found in Google Sheets. Please ensure the sheet is publicly accessible and contains data in the expected tabs: CRUISES, BOOKED CRUISES, CASINO OVERVIEW OFFERS, TRIPIT CALENDAR ICS');
    }
    
    return sheetData;
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    throw error;
  }
}

