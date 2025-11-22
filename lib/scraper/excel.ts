import * as XLSX from 'xlsx';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface OfferRow {
  'Offer Name': string;
  'Offer Code': string;
  'OFFER EXPIRE DATE': string;
  'Type of Offer': string;
  'VALUE': string;
  'HTML URL Link': string;
  '# of Cruises': number;
}

interface CruiseRow {
  'Offer Name': string;
  'Offer Code': string;
  'OFFER EXPIRE DATE': string;
  'Type of Offer': string;
  'VALUE': string;
  'Sailing Date': string;
  'Ship Name': string;
  'Ship Code': string;
  'Nights': number;
  'Departure Port': string;
  'Itinerary': string;
  'Cabin Type': string;
  '# of Guests': number;
}

const OFFERS_HEADERS = [
  'Offer Name',
  'Offer Code',
  'OFFER EXPIRE DATE',
  'Type of Offer',
  'VALUE',
  'HTML URL Link',
  '# of Cruises',
];

const CRUISES_HEADERS = [
  'Offer Name',
  'Offer Code',
  'OFFER EXPIRE DATE',
  'Type of Offer',
  'VALUE',
  'Sailing Date',
  'Ship Name',
  'Ship Code',
  'Nights',
  'Departure Port',
  'Itinerary',
  'Cabin Type',
  '# of Guests',
];

export async function exportOffersExcel(offers: OfferRow[]): Promise<string> {
  console.log(`[Excel] Exporting ${offers.length} offers`);

  const data = offers.map((offer) => {
    const row: any = {};
    for (const header of OFFERS_HEADERS) {
      row[header] = offer[header as keyof OfferRow] ?? '';
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(data, { header: OFFERS_HEADERS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'OFFERS');

  const fileName = 'offers.xlsx';

  if (Platform.OS === 'web') {
    const wbout = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    console.log(`[Excel] Offers downloaded`);
    return fileName;
  } else {
    const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const filePath = `${(FileSystem as any).documentDirectory}${fileName}`;

    await (FileSystem as any).writeAsStringAsync(filePath, wbout, {
      encoding: 'base64',
    });

    console.log(`[Excel] Offers saved to ${filePath}`);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Save Offers',
        UTI: 'com.microsoft.excel.xlsx',
      });
    }

    return filePath;
  }
}

export async function exportCruisesExcel(cruises: CruiseRow[]): Promise<string> {
  console.log(`[Excel] Exporting ${cruises.length} cruises`);

  const data = cruises.map((cruise) => {
    const row: any = {};
    for (const header of CRUISES_HEADERS) {
      row[header] = cruise[header as keyof CruiseRow] ?? '';
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(data, { header: CRUISES_HEADERS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CRUISES');

  const fileName = 'cruises.xlsx';

  if (Platform.OS === 'web') {
    const wbout = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    console.log(`[Excel] Cruises downloaded`);
    return fileName;
  } else {
    const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
    const filePath = `${(FileSystem as any).documentDirectory}${fileName}`;

    await (FileSystem as any).writeAsStringAsync(filePath, wbout, {
      encoding: 'base64',
    });

    console.log(`[Excel] Cruises saved to ${filePath}`);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Save Cruises',
        UTI: 'com.microsoft.excel.xlsx',
      });
    }

    return filePath;
  }
}
