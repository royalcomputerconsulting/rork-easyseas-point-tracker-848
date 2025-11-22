import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { 
  FileUp, 
  Check,
  Calendar,
  Ship,
  Gift,
  Folder,
  Download,
  Archive,
  ArrowLeft
} from "lucide-react-native";
import { useAppState } from "@/state/AppStateProvider";
import * as DocumentPicker from 'expo-document-picker';
import { trpcClient, isBackendEnabled } from "@/lib/trpc";
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import AsyncStorage from "@react-native-async-storage/async-storage";
import JSZip from 'jszip';
import { useCruiseStore } from "@/state/CruiseStore";
import { useUser } from "@/state/UserProvider";

// Added 'tripit' as a distinct ICS source alongside 'calendar'
type FileType = 'cruises' | 'booked' | 'offers' | 'offersCsv' | 'tripit' | 'calendar' | 'financials' | 'userProfile' | 'zipBundle';

interface SelectedFiles {
  cruises?: DocumentPicker.DocumentPickerAsset;
  booked?: DocumentPicker.DocumentPickerAsset;
  offers?: DocumentPicker.DocumentPickerAsset;
  offersCsv?: DocumentPicker.DocumentPickerAsset;
  tripit?: DocumentPicker.DocumentPickerAsset;
  calendar?: DocumentPicker.DocumentPickerAsset;
  financials?: DocumentPicker.DocumentPickerAsset;
  userProfile?: DocumentPicker.DocumentPickerAsset;
  zipBundle?: DocumentPicker.DocumentPickerAsset;
}

export default function ImportScreen() {
  const { updateLastImportDate, refreshLocalData, clubRoyaleProfile, userPoints, loyaltyPoints, settings } = useAppState();
  const queryClient = useQueryClient();
  const { upsertCruises, reload: reloadCruiseStore } = useCruiseStore();
  const { currentUser, currentUserId } = useUser();
  const userKey = currentUserId ?? 'owner';
  
  const [loading, setLoading] = React.useState<boolean>(false);
  const [previewData, setPreviewData] = React.useState<any>(null);
  const [selectedFiles, setSelectedFiles] = React.useState<SelectedFiles>({});
  const [localImporting, setLocalImporting] = React.useState<boolean>(false);
  const [scanningDataFolder, setScanningDataFolder] = React.useState<boolean>(false);
  const [exportingFile, setExportingFile] = React.useState<string | null>(null);
  const [exportedCounts, setExportedCounts] = React.useState<Record<string, number>>({});

  const resetImportState = () => {
    console.log('[Import] Resetting import state');
    setPreviewData(null);
    setSelectedFiles({});
    setExportedCounts({});
    setLoading(false);
    setLocalImporting(false);
  };

  console.log('[Import] Component mounted');

  const handleFileUpload = async (fileType: FileType) => {
    try {
      console.log(`[Import] Starting file upload for type: ${fileType}`);
      
      const isIcs = fileType === 'calendar' || fileType === 'tripit';
      const isXlsx = fileType === 'cruises' || fileType === 'booked' || fileType === 'offers' || fileType === 'financials' || fileType === 'userProfile';
      const isCsv = fileType === 'offersCsv';
      const isZip = fileType === 'zipBundle';
      const documentTypes: string[] = isIcs
        ? ['text/calendar', 'text/plain']
        : isCsv
        ? ['text/csv', 'application/csv', 'text/plain']
        : isXlsx
        ? [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
          ]
        : isZip
        ? ['application/zip', 'application/x-zip-compressed']
        : ['*/*'];
      
      console.log(`[Import] Document types for ${fileType}:`, documentTypes);
      console.log(`[Import] About to call DocumentPicker.getDocumentAsync`);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await DocumentPicker.getDocumentAsync({
        type: documentTypes,
        copyToCacheDirectory: true,
        multiple: false,
      });

      console.log(`[Import] Document picker result for ${fileType}:`, {
        canceled: result.canceled,
        assetsLength: result.assets?.length || 0,
        firstAsset: result.assets?.[0] ? {
          name: result.assets[0].name,
          size: result.assets[0].size,
          mimeType: result.assets[0].mimeType
        } : null
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        console.log(`[Import] Processing selected ${fileType} file:`, {
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
          uri: file.uri ? 'present' : 'missing'
        });
        
        setSelectedFiles(prev => ({ ...prev, [fileType]: file }));
        
        Alert.alert(
          'File Selected ✅', 
          `Selected ${fileType.toUpperCase()}: ${file.name}\nSize: ${((file.size || 0) / 1024).toFixed(1)} KB`,
          [{ text: 'OK' }]
        );
      } else {
        console.log(`[Import] File selection canceled or no assets for ${fileType}`);
        if (result.canceled) {
          console.log(`[Import] User canceled file selection for ${fileType}`);
        } else {
          console.log(`[Import] No assets returned for ${fileType}`);
        }
      }
    } catch (error: any) {
      console.error(`[Import] File picker error for ${fileType}:`, error);
      console.error(`[Import] Error name:`, error.name);
      console.error(`[Import] Error message:`, error.message);
      console.error(`[Import] Error stack:`, error.stack);
      
      Alert.alert(
        'File Picker Error',
        `Failed to select ${fileType} file.\n\nError: ${error.message || 'Unknown error'}\n\nPlease try again or restart the app if the issue persists.`,
        [{ text: 'OK' }]
      );
    }
  };

  const loadPreview = async () => {
    const hasFiles = Object.keys(selectedFiles).length > 0;
    if (!hasFiles) {
      Alert.alert("Error", "Please select at least one file first");
      return;
    }

    setLoading(true);
    console.log("[Import] Loading preview from files");

    try {
      const parsed: any = {};
      
      for (const [fileType, file] of Object.entries(selectedFiles) as Array<[FileType, DocumentPicker.DocumentPickerAsset | undefined]>) {
        if (!file) continue;
        
        console.log(`[Import] Processing ${fileType} file:`, file.name, file.uri);
        
        if (fileType === 'zipBundle') {
          console.log('[Import] Extracting ZIP bundle...');
          try {
            let zipData: ArrayBuffer;
            
            if (Platform.OS === 'web') {
              const response = await fetch(file.uri);
              zipData = await response.arrayBuffer();
            } else {
              const response = await fetch(file.uri);
              zipData = await response.arrayBuffer();
            }
            
            const zip = await JSZip.loadAsync(zipData);
            console.log('[Import] ZIP loaded, files:', Object.keys(zip.files));
            
            const fileMapping: Record<string, FileType> = {
              'cruises.xlsx': 'cruises',
              'booked.xlsx': 'booked',
              'offers.xlsx': 'offers',
              'tripit.ics': 'tripit',
              'calendar.ics': 'calendar',
              'financials.xlsx': 'financials',
              'userProfile.xlsx': 'userProfile'
            };
            
            for (const [fileName, mappedType] of Object.entries(fileMapping)) {
              const zipFile = zip.file(fileName);
              if (zipFile) {
                console.log(`[Import] Extracting ${fileName} from ZIP...`);
                
                // Handle ICS files differently
                if (fileName.endsWith('.ics')) {
                  const icsContent = await zipFile.async('text');
                  const events = parseICalContent(icsContent);
                  parsed[mappedType] = events;
                  console.log(`[Import] ${mappedType}: Extracted ${events.length} events from ZIP`);
                } else {
                  // Handle XLSX files
                  const fileData = await zipFile.async('arraybuffer');
                  const workbook = XLSX.read(fileData, { type: 'array' });
                  
                  console.log(`[Import] Available sheets in ${fileName}:`, workbook.SheetNames);
                  const sheetName = workbook.SheetNames[0];
                  if (sheetName) {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                    
                    if (jsonData.length > 1) {
                      const headers = jsonData[0] as string[];
                      const rows = jsonData.slice(1).filter((row: any) => 
                        row.some((cell: any) => cell !== null && cell !== undefined && cell !== '')
                      );
                      
                      console.log(`[Import] Sheet ${sheetName}: ${rows.length} data rows`);
                      
                      const mappedData = rows.map((row: any) => {
                        const obj: any = {};
                        headers.forEach((header, index) => {
                          if (header && row[index] !== undefined && row[index] !== null && row[index] !== '') {
                            obj[header] = row[index];
                          }
                        });
                        return obj;
                      }).filter((obj: any) => Object.keys(obj).length > 0);
                      
                      console.log(`[Import] ${mappedType}: Extracted ${mappedData.length} items from ZIP`);
                      parsed[mappedType] = mappedData;
                    }
                  }
                }
              } else {
                console.log(`[Import] ${fileName} not found in ZIP`);
              }
            }
            
            console.log('[Import] ZIP extraction complete');
          } catch (zipError: any) {
            console.error('[Import] ZIP extraction error:', zipError);
            Alert.alert('Error', `Failed to extract ZIP file: ${zipError.message}`);
            continue;
          }
          continue;
        }
        
        if (fileType === 'offersCsv') {
          let csvText = '';
          if (Platform.OS === 'web') {
            const res = await fetch(file.uri);
            csvText = await res.text();
          } else {
            const res = await fetch(file.uri);
            csvText = await res.text();
          }
          const wb = XLSX.read(csvText, { type: 'string' });
          const sheetName = wb.SheetNames[0];
          if (sheetName) {
            const ws = wb.Sheets[sheetName];
            const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
            if (grid.length > 1) {
              const headers = (grid[0] as string[]).map(h => String(h).trim());
              const rows = grid.slice(1).filter(r => r.some(c => c !== '' && c !== null && c !== undefined));
              const idx = (name: string) => {
                const lower = name.toLowerCase();
                return headers.findIndex(h => {
                  const headerLower = String(h).toLowerCase().trim();
                  return headerLower === lower || 
                         headerLower.replace(/[\s_-]/g, '') === lower.replace(/[\s_-]/g, '') ||
                         (lower === 'code' && headerLower === 'offer code') ||
                         (lower === 'name' && headerLower === 'offer name') ||
                         (lower === 'expires' && headerLower === 'offer expiry date') ||
                         (lower === 'sail date' && (headerLower === 'sailing date' || headerLower === 'cruise_date' || headerLower === 'cruise date')) ||
                         (lower === 'ship' && (headerLower === 'ship_name' || headerLower === 'ship name')) ||
                         (lower === 'destination' && (headerLower === 'cruise_title' || headerLower === 'cruise title')) ||
                         (lower === 'departs' && (headerLower === 'departure port' || headerLower.includes('departing from')));
                });
              };
              const get = (row: any[], name: string) => {
                const i = idx(name);
                return i >= 0 ? row[i] : '';
              };
              const offersMapByCode = new Map<string, any>();
              const cruisesFromCsv: any[] = [];
              for (const row of rows) {
                const code = String(get(row, 'Code') || '').trim();
                const name = String(get(row, 'Name') || '').trim();
                const expiresRaw = get(row, 'Expires');
                const ship = String(get(row, 'Ship') || '').toString().replace(/\s*®|\s*™|\s*\[R\]/g, '').trim();
                const sailDateRaw = get(row, 'Sail Date');
                const departs = String(get(row, 'Departs') || '').trim();
                // Calculate nights from stops (each stop represents a day)
                const stops = [get(row, 'stop_1_date'), get(row, 'stop_2_date'), get(row, 'stop_3_date'), get(row, 'stop_4_date')].filter(Boolean);
                const nightsNum = stops.length > 0 ? stops.length : (parseInt(String(get(row, 'Nights') || '0')) || 0);
                const destination = String(get(row, 'Destination') || '').trim();
                const category = String(get(row, 'Category') || '').trim();
                const guestsNum = parseInt(String(get(row, 'Guests') || '0')) || 0;
                const perks = String(get(row, 'Perks') || '').trim();
                const toIso = (v: any): string | '' => {
                  if (!v) return '';
                  if (typeof v === 'number') {
                    const excelEpoch = new Date(1900, 0, 1);
                    const d = new Date(excelEpoch.getTime() + (v - 2) * 86400000);
                    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
                  }
                  const d = new Date(String(v));
                  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
                  const mmdd = String(v).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
                  if (mmdd) {
                    const m = parseInt(mmdd[1], 10); const da = parseInt(mmdd[2], 10); const y = parseInt(mmdd[3].length === 2 ? `20${mmdd[3]}` : mmdd[3], 10);
                    const dt = new Date(y, m - 1, da);
                    return isNaN(dt.getTime()) ? '' : dt.toISOString().split('T')[0];
                  }
                  return '';
                };
                const expires = toIso(expiresRaw) || '';
                const sailDate = toIso(sailDateRaw) || '';
                if (code && !offersMapByCode.has(code)) {
                  offersMapByCode.set(code, {
                    id: `offer-${code}`,
                    name: name || 'Unknown',
                    rewardNumber: '',
                    offerName: name || '',
                    offerType: category || '',
                    offerCode: code,
                    tradeInValue: perks || '',
                    expires,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                }
                if (ship && sailDate) {
                  let returnDate: string | undefined = undefined;
                  if (nightsNum > 0) {
                    const start = new Date(sailDate);
                    start.setDate(start.getDate() + nightsNum);
                    returnDate = start.toISOString().split('T')[0];
                  }
                  cruisesFromCsv.push({
                    id: `cruise-${ship}-${sailDate}`,
                    ship,
                    itineraryName: destination || '',
                    departurePort: departs || '',
                    departureDate: sailDate,
                    returnDate: returnDate ?? '',
                    nights: nightsNum || 0,
                    line: 'Royal Caribbean',
                    stateroomTypes: ['Interior','Oceanview','Balcony','Suite'],
                    status: 'on_sale',
                    cabinType: category || undefined,
                    guests: guestsNum || undefined,
                    offerName: name || undefined,
                    offerCode: code || undefined,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                }
              }
              const offersFromCsv = Array.from(offersMapByCode.values());
              parsed.offers = [...(parsed.offers || []), ...offersFromCsv];
              parsed.cruises = [...(parsed.cruises || []), ...cruisesFromCsv];
              console.log(`[Import] Offers.CSV parsed -> unique offers: ${offersFromCsv.length}, cruises: ${cruisesFromCsv.length}`);
              console.log('[Import] Offers.CSV headers detected:', headers);
              console.log('[Import] Sample offer data:', offersFromCsv[0]);
              console.log('[Import] Sample cruise data:', cruisesFromCsv[0]);
            }
          }
        } else if (fileType === 'calendar' || fileType === 'tripit') {
          let icalContent: string;
          
          if (Platform.OS === 'web') {
            const response = await fetch(file.uri);
            icalContent = await response.text();
          } else {
            try {
              const response = await fetch(file.uri);
              icalContent = await response.text();
            } catch (fetchError) {
              console.error('[Import] Fetch failed for ICS file:', fetchError);
              Alert.alert('Error', 'Could not read ICS file. Please try again.');
              continue;
            }
          }
          
          const events = parseICalContent(icalContent);
          parsed[fileType] = events;
          console.log(`[Import] Parsed ${events.length} ${fileType} events`);
          
        } else if (fileType === 'financials' || fileType === 'userProfile') {
          let workbook: any;
          
          if (Platform.OS === 'web') {
            const response = await fetch(file.uri);
            const arrayBuffer = await response.arrayBuffer();
            workbook = XLSX.read(arrayBuffer, { type: 'array' });
          } else {
            try {
              const response = await fetch(file.uri);
              const arrayBuffer = await response.arrayBuffer();
              workbook = XLSX.read(arrayBuffer, { type: 'array' });
            } catch (fetchError) {
              console.error(`[Import] Could not read ${fileType} file:`, fetchError);
              Alert.alert('Error', `Could not read ${fileType} file. Please ensure it's a valid XLSX file.`);
              continue;
            }
          }
          
          console.log(`[Import] Available sheets in ${fileType}:`, workbook.SheetNames);
          const sheetName = workbook.SheetNames[0];
          if (sheetName) {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            
            if (jsonData.length > 1) {
              const headers = jsonData[0] as string[];
              const rows = jsonData.slice(1).filter((row: any) => 
                row.some((cell: any) => cell !== null && cell !== undefined && cell !== '')
              );
              
              console.log(`[Import] Sheet ${sheetName}: ${rows.length} data rows`);
              
              const mappedData = rows.map((row: any) => {
                const obj: any = {};
                headers.forEach((header, index) => {
                  if (header && row[index] !== undefined && row[index] !== null && row[index] !== '') {
                    obj[header] = row[index];
                  }
                });
                return obj;
              }).filter((obj: any) => Object.keys(obj).length > 0);
              
              console.log(`[Import] ${fileType}: Importing ALL ${mappedData.length} items`);
              parsed[fileType] = mappedData;
            }
          }
        } else {
          let workbook: any;
          
          if (Platform.OS === 'web') {
            const response = await fetch(file.uri);
            const arrayBuffer = await response.arrayBuffer();
            workbook = XLSX.read(arrayBuffer, { type: 'array' });
          } else {
            try {
              const response = await fetch(file.uri);
              const arrayBuffer = await response.arrayBuffer();
              workbook = XLSX.read(arrayBuffer, { type: 'array' });
            } catch (fetchError) {
              console.error(`[Import] Could not read ${fileType} file:`, fetchError);
              Alert.alert('Error', `Could not read ${fileType} file. Please ensure it's a valid XLSX file.`);
              continue;
            }
          }
          
          console.log(`[Import] Available sheets in ${fileType}:`, workbook.SheetNames);
          
          const pickSheetForType = (type: string): string | undefined => {
            const lower = workbook.SheetNames.map((n: string) => n.toLowerCase());
            if (type === 'cruises') {
              const idx = lower.findIndex((n: string) => n.includes('cruise'));
              return idx >= 0 ? workbook.SheetNames[idx] : workbook.SheetNames[0];
            }
            if (type === 'booked') {
              const idx = lower.findIndex((n: string) => n.includes('book'));
              return idx >= 0 ? workbook.SheetNames[idx] : workbook.SheetNames[0];
            }
            if (type === 'offers') {
              const idx = lower.findIndex((n: string) => n.includes('offer') || n.includes('casino'));
              return idx >= 0 ? workbook.SheetNames[idx] : workbook.SheetNames[0];
            }
            if (type === 'calendar') {
              const idx = lower.findIndex((n: string) => n.includes('cal'));
              return idx >= 0 ? workbook.SheetNames[idx] : workbook.SheetNames[0];
            }
            return workbook.SheetNames[0];
          };

          const sheetName = pickSheetForType(fileType);
          if (sheetName) {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            
            if (jsonData.length > 1) {
              const headers = jsonData[0] as string[];
              const rows = jsonData.slice(1).filter((row: any) => 
                row.some((cell: any) => cell !== null && cell !== undefined && cell !== '')
              );
              
              console.log(`[Import] Sheet ${sheetName}: ${rows.length} data rows`);
              
              const mappedData = rows.map((row: any) => {
                const obj: any = {};
                headers.forEach((header, index) => {
                  if (header && row[index] !== undefined && row[index] !== null && row[index] !== '') {
                    obj[header] = row[index];
                  }
                });
                return obj;
              }).filter((obj: any) => Object.keys(obj).length > 0);
              
              console.log(`[Import] ${fileType}: Importing ALL ${mappedData.length} items (no filtering applied)`);
              parsed[fileType] = mappedData;
            }
          }
        }
      }
      
      console.log('[Import] Final parsed data summary:', {
        cruises: parsed.cruises?.length || 0,
        booked: parsed.booked?.length || 0,
        offers: parsed.offers?.length || 0,
        tripit: parsed.tripit?.length || 0,
        calendar: parsed.calendar?.length || 0,
        financials: parsed.financials?.length || 0,
        userProfile: parsed.userProfile?.length || 0
      });
      
      if (!parsed.cruises && !parsed.booked && !parsed.offers && !parsed.calendar && !parsed.tripit && !parsed.financials && !parsed.userProfile) {
        Alert.alert('No Data Found', 'Could not find any data in the selected files.');
        return;
      }
      
      setPreviewData(parsed);
      
    } catch (error: any) {
      console.error('[Import] File processing error:', error);
      Alert.alert('Error', `Failed to process files: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const parseICalContent = (icalContent: string) => {
    const events: any[] = [];
    const rawLines = icalContent.split(/\r?\n/);
    
    const lines: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (line.startsWith(' ') || line.startsWith('\t')) {
        if (lines.length > 0) {
          lines[lines.length - 1] += line.substring(1);
        }
      } else {
        lines.push(line);
      }
    }
    
    let currentEvent: any = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === 'BEGIN:VEVENT') {
        currentEvent = {
          summary: '',
          startDate: '',
          endDate: '',
          location: '',
          description: ''
        };
      } else if (line === 'END:VEVENT' && currentEvent) {
        if (currentEvent.summary && currentEvent.startDate) {
          if (!currentEvent.endDate) {
            currentEvent.endDate = currentEvent.startDate;
          }
          events.push(currentEvent);
        }
        currentEvent = null;
      } else if (currentEvent && line.includes(':')) {
        const colonIndex = line.indexOf(':');
        const fullKey = line.substring(0, colonIndex);
        const key = fullKey.split(';')[0];
        const value = line.substring(colonIndex + 1);
        
        switch (key) {
          case 'SUMMARY':
            currentEvent.summary = value
              .replace(/\\\\,/g, ',')
              .replace(/\\\\;/g, ';')
              .replace(/\\\\n/g, ' ')
              .trim();
            break;
          case 'DTSTART':
            currentEvent.startDate = parseICalDate(value);
            break;
          case 'DTEND':
            currentEvent.endDate = parseICalDate(value);
            break;
          case 'LOCATION':
            currentEvent.location = value
              .replace(/\\\\,/g, ',')
              .replace(/\\\\;/g, ';')
              .replace(/\\\\n/g, ' ')
              .trim();
            break;
          case 'DESCRIPTION':
            currentEvent.description = value
              .replace(/\\\\n/g, '\n')
              .replace(/\\\\,/g, ',')
              .replace(/\\\\;/g, ';')
              .trim();
            break;
        }
      }
    }
    
    console.log(`[Import] Parsed ${events.length} events from ICS file`);
    return events;
  };
  
  const parseICalDate = (dateStr: string): string => {
    try {
      if (dateStr.length === 8) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${year}-${month}-${day}`;
      } else if (dateStr.includes('T')) {
        const datePart = dateStr.split('T')[0];
        const year = datePart.substring(0, 4);
        const month = datePart.substring(4, 6);
        const day = datePart.substring(6, 8);
        return `${year}-${month}-${day}`;
      } else {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
      
      return new Date().toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  function toICSFile(events: any[], calendarName: string): string {
    const lines: string[] = [];
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push(`PRODID:-//Cruise App//EN`);
    lines.push(`X-WR-CALNAME:${calendarName}`);
    const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    for (const ev of events) {
      const uid = `evt-${ev.id ?? Math.random().toString(36).slice(2)}@cruise-app`;
      const startDate = (ev.startDate ?? ev.date ?? '').toString().replace(/-/g, '');
      const endDate = (ev.endDate ?? ev.startDate ?? ev.date ?? '').toString().replace(/-/g, '');
      const start = startDate ? `${startDate}T090000Z` : dtstamp;
      const end = endDate ? `${endDate}T170000Z` : dtstamp;
      const summary = (ev.summary ?? ev.title ?? ev.itineraryName ?? 'Event').toString().replace(/[\n\r]+/g, ' ');
      const location = (ev.location ?? ev.ship ?? '').toString().replace(/[\n\r]+/g, ' ');
      const description = (ev.description ?? '').toString().replace(/\n/g, '\\n');
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
      if (summary) lines.push(`SUMMARY:${summary}`);
      if (location) lines.push(`LOCATION:${location}`);
      if (description) lines.push(`DESCRIPTION:${description}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  async function loadLocal<T = any>(key: string): Promise<T | null> {
    try { const raw = await AsyncStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
  }

  function mapCruiseForExport(c: any) {
    const interiorPrice = c?.pricingCurrent?.interior ?? c?.pricing?.interior ?? null;
    return {
      id: c.id ?? '',
      ship: c.ship ?? '',
      itineraryName: c.itineraryName ?? '',
      'Departure Date': c.departureDate ?? '',
      Nights: c.nights ?? '',
      'Interior retail price': interiorPrice ?? '',
      'All Ports': c.portsRoute ?? c.allPorts ?? '',
      offerName: c.offerName ?? '',
      offerCode: c.offerCode ?? '',
      line: c.line ?? '',
    };
  }

  function xlsxFromJson(data: any[], sheetName: string) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  }

  const handleLocalOnlyImport = async () => {
    if (!previewData) {
      Alert.alert("Error", "Please load preview first");
      return;
    }
    
    const totalRows = (previewData.cruises?.length || 0) + 
                     (previewData.booked?.length || 0) + 
                     (previewData.offers?.length || 0) + 
                     (previewData.tripit?.length || 0) +
                     (previewData.calendar?.length || 0);
    
    console.log('[Import] Local-only import starting. Total rows:', totalRows);
    console.log('[Import] Data breakdown:', {
      cruises: previewData.cruises?.length || 0,
      booked: previewData.booked?.length || 0,
      offers: previewData.offers?.length || 0,
      tripit: previewData.tripit?.length || 0,
      calendar: previewData.calendar?.length || 0
    });
    
    setLocalImporting(true);
    console.log('[Import] Starting local save process...');
    
    try {
      console.log('[Import] Processing data locally...');
              
              let backendSyncSuccessful = false;
              if (isBackendEnabled) {
                try {
                  console.log('[Import] Attempting to sync with backend...');
                  await Promise.race([
                    trpcClient.ping.query(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
                  ]);
                  console.log('[Import] Backend connectivity test passed');
                  // Skipping backend import: no importLocalFile route available. Keep local-only save.
                } catch (backendError: any) {
                  console.warn('[Import] ⚠️ Backend check failed, proceeding with local-only import:', backendError.message);
                  Alert.alert(
                    '⚠️ Backend Unreachable',
                    `Could not reach backend. Your data will be saved locally and you can try syncing later.\n\nError: ${backendError.message || 'Connection failed'}`,
                    [{ text: 'Continue' }]
                  );
                }
              } else {
                console.log('[Import] Backend disabled. Skipping connectivity and sync.');
              }
              
              const processedCruises = (previewData.cruises ?? []).map((cruise: any, index: number) => {
                let departureDate: string | '' = '';
                let rawDeparture = cruise.departureDate || cruise['Sailing Date'] || cruise['SAILING DATE'] || cruise['SALING DATE'] || cruise['Saling Date'] || cruise['Departure Date'];
                if (rawDeparture !== undefined && rawDeparture !== null && rawDeparture !== '') {
                  if (typeof rawDeparture === 'number') {
                    const excelEpoch = new Date(1900, 0, 1);
                    const date = new Date(excelEpoch.getTime() + (rawDeparture - 2) * 24 * 60 * 60 * 1000);
                    if (!isNaN(date.getTime())) departureDate = date.toISOString().split('T')[0];
                  } else {
                    const d = new Date(String(rawDeparture));
                    if (!isNaN(d.getTime())) departureDate = d.toISOString().split('T')[0];
                    else {
                      const mmdd = String(rawDeparture).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
                      if (mmdd) {
                        const m = parseInt(mmdd[1], 10);
                        const day = parseInt(mmdd[2], 10);
                        const y = parseInt(mmdd[3].length === 2 ? `20${mmdd[3]}` : mmdd[3], 10);
                        const dt = new Date(y, m - 1, day);
                        if (!isNaN(dt.getTime())) departureDate = dt.toISOString().split('T')[0];
                      }
                    }
                  }
                }
                
                const nights = parseInt(String(cruise.nights || cruise['Nights'] || cruise['NIGHTS'] || cruise['Length'] || '0')) || 0;
                let returnDate: string | undefined = undefined;
                if (departureDate && nights > 0) {
                  const start = new Date(departureDate);
                  start.setDate(start.getDate() + nights);
                  returnDate = start.toISOString().split('T')[0];
                }
                
                const interiorRaw = cruise['Interior retail price'] ?? cruise['Interior Price'] ?? cruise.price ?? cruise['PRICE'] ?? null;
                const interiorParsed = (() => {
                  if (typeof interiorRaw === 'number') return interiorRaw;
                  if (typeof interiorRaw === 'string') {
                    const n = Number(interiorRaw.replace(/[^0-9.]/g, ''));
                    return Number.isFinite(n) ? n : null;
                  }
                  return null;
                })();

                const mappedCruise = {
                  id: cruise.id || `cruise-${Date.now()}-${index}`,
                  ship: (cruise.ship || cruise['Ship Name'] || cruise['SHIP NAME'] || cruise['Ship'] || 'Unknown Ship')
                    .replace(/\s*\[R\]\s*/g, '')
                    .replace(/\s*®\s*/g, '')
                    .replace(/\s*™\s*/g, '')
                    .trim(),
                  itineraryName: cruise.itineraryName || cruise['Itinerary'] || cruise['ITINERARY'] || cruise['Itinerary Name'] || 'Unknown Itinerary',
                  departurePort: cruise.departurePort || cruise['Departure Port'] || cruise['DEPARTURE PORT'] || cruise['Port'] || 'Unknown Port',
                  departureDate,
                  returnDate: returnDate ?? '',
                  nights,
                  line: cruise.line || cruise['Line'] || cruise['LINE'] || 'Royal Caribbean',
                  region: cruise.region || cruise['Region'] || cruise['REGION'] || 'Caribbean',
                  stateroomTypes: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
                  status: 'on_sale' as const,
                  cabinType: cruise.cabinType || cruise['Cabin Type'] || cruise['CABIN TYPE'] || 'Interior',
                  casinoOfferType: cruise['CASINO OVERVIEW OFFER TYPE'] || cruise.casinoOfferType,
                  offerName: cruise['Offer Name'] || cruise.offerName,
                  offerCode: cruise['Offer Code'] || cruise.offerCode,
                  offerExpireDate: cruise['OFFER EXPIRE DATE'] || cruise.offerExpireDate,
                  typeOfOffer: cruise['Type of Offer'] || cruise.typeOfOffer,
                  value: cruise['Value'] || cruise.value,
                  portsRoute: cruise['All Ports'] || cruise['ALL PORTS'] || cruise.allPorts || cruise.portsRoute,
                  pricingCurrent: interiorParsed !== null ? { interior: interiorParsed, source: 'xlsx', fetchedAt: new Date().toISOString() } : undefined,
                  ...cruise,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                return mappedCruise;
              });
              
              const processedBooked = (previewData.booked ?? []).map((booked: any, index: number) => {
                let startDate = booked.startDate || booked['Start Date'] || booked['START DATE'];
                if (startDate && typeof startDate === 'number') {
                  const excelEpoch = new Date(1900, 0, 1);
                  const date = new Date(excelEpoch.getTime() + (startDate - 2) * 24 * 60 * 60 * 1000);
                  startDate = date.toISOString().split('T')[0];
                } else if (startDate) {
                  const parsed = new Date(startDate);
                  if (!isNaN(parsed.getTime())) {
                    startDate = parsed.toISOString().split('T')[0];
                  } else {
                    startDate = new Date().toISOString().split('T')[0];
                  }
                } else {
                  startDate = new Date().toISOString().split('T')[0];
                }
                
                let endDate = booked.endDate || booked['End Date'] || booked['END DATE'];
                if (endDate && typeof endDate === 'number') {
                  const excelEpoch = new Date(1900, 0, 1);
                  const date = new Date(excelEpoch.getTime() + (endDate - 2) * 24 * 60 * 60 * 1000);
                  endDate = date.toISOString().split('T')[0];
                } else if (endDate) {
                  const parsed = new Date(endDate);
                  if (!isNaN(parsed.getTime())) {
                    endDate = parsed.toISOString().split('T')[0];
                  } else {
                    const nights = parseInt(String(booked.nights || booked['Nights'] || '7'));
                    const start = new Date(startDate);
                    start.setDate(start.getDate() + nights);
                    endDate = start.toISOString().split('T')[0];
                  }
                } else {
                  const nights = parseInt(String(booked.nights || booked['Nights'] || '7'));
                  const start = new Date(startDate);
                  start.setDate(start.getDate() + nights);
                  endDate = start.toISOString().split('T')[0];
                }
                
                const mappedBooked = {
                  id: booked.id || `booked-${Date.now()}-${index}`,
                  ship: (booked.ship || booked['Ship'] || booked['SHIP'] || 'Unknown Ship')
                    .replace(/\s*\[R\]\s*/g, '')
                    .replace(/\s*®\s*/g, '')
                    .replace(/\s*™\s*/g, '')
                    .replace(/\s*\u2120\s*/g, '')
                    .trim(),
                  startDate,
                  endDate,
                  nights: parseInt(String(booked.nights || booked['Nights'] || booked['NIGHTS'] || '7')),
                  itineraryName: booked.itineraryName || booked['Itinerary Name'] || booked['ITINERARY NAME'] || booked['Itinerary'] || 'Unknown Itinerary',
                  departurePort: booked.departurePort || booked['Departure Port'] || booked['DEPARTURE PORT'] || 'Unknown Port',
                  portsRoute: booked.portsRoute || booked['Ports/Route'] || booked['PORTS/ROUTE'] || booked['Ports Route'] || 'Route not available',
                  reservationNumber: String(booked.reservationNumber || booked['Reservation'] || booked['RESERVATION'] || booked['Booking ID'] || booked['BOOKING ID#'] || booked['BOOKING ID'] || ''),
                  guests: parseInt(String(booked.guests || booked['Guests'] || booked['GUESTS'] || '2')),
                  daysToGo: parseInt(String(booked.daysToGo || booked['Days to Go'] || booked['DAYS TO GO'] || '0')),
                  paidFare: parseFloat(String(booked.paidFare || booked['Paid Fare'] || '0')) || 0,
                  actualFare: parseFloat(String(booked.actualFare || booked['Actual Fare'] || '0')) || 0,
                  currentMarketPrice: parseFloat(String(booked.currentMarketPrice || booked['Current Market Price'] || '0')) || 0,
                  actualSavings: parseFloat(String(booked.actualSavings || booked['Actual Savings'] || '0')) || 0,
                  projectedSavings: parseFloat(String(booked.projectedSavings || booked['Projected Savings'] || '0')) || 0,
                  ...booked,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                return mappedBooked;
              });
              
              const processedOffers = (previewData.offers ?? []).map((offer: any, index: number) => {
                let expires = offer.expires || offer['EXPIRES'] || offer['Expires'] || offer['Expiration Date'] || offer['OFFER EXPIRE DATE'] || offer['Offer Expire Date'];
                if (expires && typeof expires === 'number') {
                  const excelEpoch = new Date(1900, 0, 1);
                  const date = new Date(excelEpoch.getTime() + (expires - 2) * 24 * 60 * 60 * 1000);
                  expires = date.toISOString().split('T')[0];
                } else if (expires) {
                  const parsed = new Date(expires);
                  if (!isNaN(parsed.getTime())) {
                    expires = parsed.toISOString().split('T')[0];
                  } else {
                    const parts = String(expires).split('/');
                    if (parts.length === 3) {
                      const month = parseInt(parts[0]);
                      const day = parseInt(parts[1]);
                      const year = parseInt(parts[2]);
                      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2024) {
                        expires = new Date(year, month - 1, day).toISOString().split('T')[0];
                      } else {
                        expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      }
                    } else {
                      expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    }
                  }
                } else {
                  expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                }
                
                const mappedOffer = {
                  id: offer.id || `offer-${Date.now()}-${index}`,
                  name: offer.name || offer['NAME'] || offer['Name'] || 'Unknown',
                  rewardNumber: String(offer.rewardNumber || offer['REWARD NUMBER'] || offer['Reward Number'] || ''),
                  offerName: offer.offerName || offer['OFFER NAME'] || offer['Offer Name'] || offer['Name'] || `Offer ${index + 1}`,
                  offerType: offer.offerType || offer['OFFER TYPE'] || offer['Offer Type'] || 'Unknown',
                  offerCode: String(offer.offerCode || offer['OFFER CODE'] || offer['Offer Code'] || offer['Code'] || 'N/A'),
                  tradeInValue: String(offer.tradeInValue || offer['TRADE IN VALUE'] || offer['Trade In Value'] || '$0'),
                  expires,
                  description: offer.description || offer['DESCRIPTION'] || offer['Description'] || offer['Details'] || '',
                  ...offer,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                return mappedOffer;
              });
              
              const processedCalendar = (previewData.calendar ?? []).map((event: any, index: number) => ({
                ...event,
                id: event.id || `event-${Date.now()}-${index}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }));

              const processedTripit = (previewData.tripit ?? []).map((event: any, index: number) => ({
                ...event,
                id: event.id || `tripit-${Date.now()}-${index}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }));
              
              const processedFinancials = (previewData.financials ?? []).map((item: any, index: number) => ({
                ...item,
                id: item.id || `financial-${Date.now()}-${index}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }));
              
              const processedUserProfile = (previewData.userProfile ?? []).map((item: any, index: number) => ({
                ...item,
                id: item.id || `profile-${Date.now()}-${index}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }));
              
              console.log('[Import] Saving all data to AsyncStorage and CruiseStore...');
              
              const validOffers = processedOffers;
              console.log(`[Import] Offers kept: ${validOffers.length} (no expiration filtering)`);
              console.log('[Import] Detailed offer data:');
              validOffers.forEach((offer: any, idx: number) => {
                console.log(`  ${idx + 1}. ${offer.offerCode} - ${offer.offerName} - expires: ${offer.expires}`);
              });
              
              try {
                console.log('[Import] Non-destructive save: preserving existing data and merging where applicable');
                
                if (processedCruises.length > 0) {
                  console.log(`[Import] Upserting ${processedCruises.length} cruises to CruiseStore...`);
                  const result = await upsertCruises(processedCruises);
                  console.log(`[Import] CruiseStore upsert result: inserted=${result.inserted}, updated=${result.updated}`);
                }
                
                if (processedBooked.length > 0) {
                  const bookedData = JSON.stringify(processedBooked);
                  console.log(`[Import] Booked data size: ${bookedData.length} characters`);
                  await AsyncStorage.setItem(`${userKey}:@local_booked`, bookedData);
                  await AsyncStorage.setItem('@local_booked', bookedData);
                  console.log(`[Import] Saved ${processedBooked.length} booked cruises`);
                }
                
                if (validOffers.length > 0) {
                  const offerData = JSON.stringify(validOffers);
                  console.log(`[Import] Offer data size: ${offerData.length} characters`);
                  await AsyncStorage.setItem(`${userKey}:@local_offers`, offerData);
                  await AsyncStorage.setItem('@local_offers', offerData);
                  console.log(`[Import] Saved ${validOffers.length} offers`);
                  try {
                    if (Platform.OS === 'web') {
                      console.log('[Import] Persisting offers to web DB (offers.database.json)');
                      const res = await fetch('/api/data/offers.database.json', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: offerData,
                      });
                      if (!res.ok) {
                        const t = await res.text().catch(() => '');
                        console.warn('[Import] Failed to persist offers to web DB:', res.status, t);
                      } else {
                        console.log('[Import] ✅ Offers persisted to offers.database.json');
                      }
                    }
                  } catch (persistErr) {
                    console.warn('[Import] Web offers DB persist error (non-fatal):', (persistErr as Error)?.message ?? String(persistErr));
                  }
                }
                
                if (processedCalendar.length > 0) {
                  const calendarData = JSON.stringify(processedCalendar);
                  console.log(`[Import] Calendar data size: ${calendarData.length} characters`);
                  await AsyncStorage.setItem(`${userKey}:@local_calendar`, calendarData);
                  await AsyncStorage.setItem('@local_calendar', calendarData);
                  console.log(`[Import] Saved ${processedCalendar.length} calendar events`);
                }

                if (processedTripit.length > 0) {
                  const tripitData = JSON.stringify(processedTripit);
                  console.log(`[Import] TripIt data size: ${tripitData.length} characters`);
                  await AsyncStorage.setItem(`${userKey}:@local_tripit`, tripitData);
                  await AsyncStorage.setItem('@local_tripit', tripitData);
                  console.log(`[Import] Saved ${processedTripit.length} TripIt events`);
                }
                
                if (processedFinancials.length > 0) {
                  const financialsData = JSON.stringify(processedFinancials);
                  console.log(`[Import] Financials data size: ${financialsData.length} characters`);
                  await AsyncStorage.setItem(`${userKey}:@local_financials`, financialsData);
                  await AsyncStorage.setItem('@local_financials', financialsData);
                  console.log(`[Import] Saved ${processedFinancials.length} financial records`);
                }
                
                if (processedUserProfile.length > 0) {
                  const userProfileData = JSON.stringify(processedUserProfile);
                  console.log(`[Import] User Profile data size: ${userProfileData.length} characters`);
                  await AsyncStorage.setItem(`${userKey}:@local_userProfile`, userProfileData);
                  await AsyncStorage.setItem('@local_userProfile', userProfileData);
                  console.log(`[Import] Saved ${processedUserProfile.length} user profile records`);
                }
                
                await AsyncStorage.setItem(`${userKey}:@local_last_import`, new Date().toISOString());
                await AsyncStorage.setItem('@local_last_import', new Date().toISOString());
                
              } catch (storageError: any) {
                console.error('[Import] AsyncStorage error:', storageError);
                throw new Error(`Failed to save data locally: ${storageError.message}`);
              }
              
              console.log('[Import] Successfully saved all data to AsyncStorage');
              console.log('[Import] Final saved data counts:', {
                cruises: processedCruises.length,
                booked: processedBooked.length,
                offers: validOffers.length,
                calendar: processedCalendar.length,
                tripit: processedTripit.length,
                financials: processedFinancials.length,
                userProfile: processedUserProfile.length
              });
              
              if (backendSyncSuccessful) {
                console.log('[Import] ✅ Data already synced with backend during initial sync');
              } else {
                console.log('[Import] ⚠️ Skipping additional backend sync due to connectivity issues');
              }
              
              updateLastImportDate(new Date().toISOString());
              console.log('[Import] Updated last import date in app state');
              
              console.log('[Import] Reloading CruiseStore...');
              await reloadCruiseStore();
              console.log('[Import] ✅ CruiseStore reloaded successfully');
              
              console.log('[Import] Refreshing local data in app state...');
              await refreshLocalData();
              console.log('[Import] ✅ Local data refreshed');
              
              console.log('[Import] Invalidating queries...');
              await queryClient.invalidateQueries({ queryKey: ['analytics'] });
              await queryClient.invalidateQueries({ queryKey: ['cruises'] });
              await queryClient.invalidateQueries({ queryKey: ['casinoOffers'] });
              await queryClient.invalidateQueries({ queryKey: ['bookedCruises'] });
              console.log('[Import] ✅ Queries invalidated');
              
              console.log('[Import] Waiting for data to settle...');
              await new Promise(resolve => setTimeout(resolve, 1500));
              
              if (backendSyncSuccessful) {
                try {
                  const finalStats = await trpcClient.ping.query();
                  console.log('[Import] ✅ Final verification - Backend ping:', finalStats.status);
                } catch (refetchError) {
                  console.warn('[Import] Could not verify final backend ping:', refetchError);
                }
              } else {
                console.log('[Import] ⚠️ Skipping backend verification (no sync attempted)');
              }
              
              const backendStatus = backendSyncSuccessful 
                ? '✅ Synced with backend server' 
                : '⚠️ Saved locally only (backend offline)';
              
              const importSummary = [
                processedCruises.length > 0 ? `• ${processedCruises.length} cruises` : null,
                processedBooked.length > 0 ? `• ${processedBooked.length} booked cruises` : null,
                validOffers.length > 0 ? `• ${validOffers.length} casino offers` : null,
                processedCalendar.length > 0 ? `• ${processedCalendar.length} calendar events` : null,
                processedTripit.length > 0 ? `• ${processedTripit.length} TripIt events` : null,
                processedFinancials.length > 0 ? `• ${processedFinancials.length} financial records` : null,
                processedUserProfile.length > 0 ? `• ${processedUserProfile.length} user profile records` : null
              ].filter(Boolean).join('\n');
              
              console.log('[Import] ✅ Import complete! Showing success alert...');
              Alert.alert(
                'Import Complete! ✅',
                `Successfully processed and saved:\n\n${importSummary}\n\n${backendStatus}\n\nData is now available in the app!`,
                [
                  { 
                    text: 'Import More', 
                    onPress: () => {
                      console.log('[Import] User wants to import more');
                      resetImportState();
                    }
                  },
                  { 
                    text: 'Go to Settings', 
                    onPress: () => {
                      console.log('[Import] User acknowledged import success');
                      resetImportState();
                      router.replace('/(tabs)/(settings)');
                    }
                  }
                ]
              );
              
    } catch (e: any) {
      console.error('[Import] Local-only import failed:', e);
      console.error('[Import] Error details:', JSON.stringify(e, null, 2));
      Alert.alert(
        'Import Failed ❌', 
        `Error: ${e?.message ?? 'Could not save locally'}\n\nPlease try again or check the console for more details.`,
        [{ text: 'OK' }]
      );
    } finally {
      setLocalImporting(false);
      console.log('[Import] Local import process completed');
    }
  };

  const handleScanDataFolder = async () => {
    console.log('[Import] Loading DATA folder directly into backend...');
    setScanningDataFolder(true);
    
    try {
      // Use loadFromDataFolder which reads files and loads them into memory store
      const result = await trpcClient.import.loadFromDataFolder.mutate();
      
      console.log('[Import] ========== DATA FOLDER LOAD RESULT ==========');
      console.log('[Import] Full result:', JSON.stringify(result, null, 2));
      console.log('[Import] Success:', result.success);
      console.log('[Import] Counts:', result.counts);
      console.log('[Import] Last import:', result.lastImport);
      console.log('[Import] ================================================');
      
      if (!result.success) {
        Alert.alert(
          'Load Failed',
          result.error || 'Could not load DATA folder',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Check if we have any data
      const totalItems = (result.counts?.cruises || 0) + 
                        (result.counts?.booked || 0) + 
                        (result.counts?.offers || 0) + 
                        (result.counts?.events || 0);
      
      if (totalItems === 0) {
        Alert.alert(
          'No Data Found',
          'No data was loaded from the DATA folder. Please check that your files exist and are properly formatted.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Update app state
      updateLastImportDate(new Date().toISOString());
      await refreshLocalData();
      
      // Invalidate queries to refresh UI
      await queryClient.invalidateQueries({ queryKey: ['analytics'] });
      await queryClient.invalidateQueries({ queryKey: ['cruises'] });
      await queryClient.invalidateQueries({ queryKey: ['casinoOffers'] });
      await queryClient.invalidateQueries({ queryKey: ['bookedCruises'] });
      
      Alert.alert(
        'DATA Folder Loaded! ✅',
        `Successfully loaded from DATA folder:\n\n` +
        `• ${result.counts?.cruises || 0} cruises\n` +
        `• ${result.counts?.booked || 0} booked cruises\n` +
        `• ${result.counts?.offers || 0} casino offers\n` +
        `• ${result.counts?.events || 0} calendar events\n\n` +
        `Data is now available in the app!`,
        [
          {
            text: 'View Cruises',
            onPress: () => {
              console.log('[Import] Navigating to cruises');
              router.replace('/(tabs)/(cruises)');
            }
          }
        ]
      );
      
    } catch (error: any) {
      console.error('[Import] DATA folder load error:', error);
      console.error('[Import] Error stack:', error.stack);
      Alert.alert(
        'Load Error',
        `Failed to load DATA folder: ${error.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setScanningDataFolder(false);
    }
  };

  const handleExportZipBundle = async () => {
    try {
      setExportingFile('zipBundle');
      console.log('[Import] Exporting ZIP bundle with all 7 files using backend...');
      
      const zip = new JSZip();
      const fileTypes: Array<'cruises' | 'booked' | 'offers' | 'tripit' | 'calendar' | 'financials' | 'userProfile'> = [
        'cruises', 'booked', 'offers', 'tripit', 'calendar', 'financials', 'userProfile'
      ];
      
      let filesAdded = 0;
      
      for (const fileType of fileTypes) {
        try {
          let data: any[] = [];
          let fileName = '';

          if (fileType === 'cruises') {
            if (isBackendEnabled) {
              try {
                const result = await trpcClient.import.exportXlsx.query({ sheet: 'cruises' });
                if (result.base64) {
                  zip.file('cruises.xlsx', Uint8Array.from(atob(result.base64), c => c.charCodeAt(0)));
                  filesAdded++;
                  console.log(`[Import] Added cruises.xlsx to ZIP from backend`);
                  continue;
                }
              } catch (err) {
                console.warn('[Import] Backend export failed, falling back to local data:', err);
              }
            }
            // Try new CruiseStore key first, then fall back to old key
            let cruises = await loadLocal<any[]>(`@cruises:${userKey}`) ?? [];
            if (cruises.length === 0) {
              cruises = await loadLocal<any[]>('@local_cruises') ?? [];
            }
            console.log(`[Import] Found ${cruises.length} cruises for export`);
            data = cruises.map(mapCruiseForExport);
            fileName = 'cruises.xlsx';
          } else if (fileType === 'booked') {
            const booked = await loadLocal<any[]>('@local_booked') ?? [];
            const cruises = await loadLocal<any[]>('@local_cruises') ?? [];
            const completed = cruises.filter(c => (c.status || '').toString().toLowerCase() === 'completed');
            data = [...booked, ...completed];
            fileName = 'booked.xlsx';
          } else if (fileType === 'offers') {
            const offers = await loadLocal<any[]>('@local_offers') ?? [];
            data = offers;
            fileName = 'offers.xlsx';
          } else if (fileType === 'tripit' || fileType === 'calendar') {
            const events = await loadLocal<any[]>(`@local_${fileType}`) ?? [];
            const ics = toICSFile(events, fileType === 'tripit' ? 'TripIt' : 'Calendar');
            const blob = new Blob([ics], { type: 'text/calendar' });
            const buf = await blob.arrayBuffer();
            zip.file(`${fileType}.ics`, buf);
            filesAdded++;
            console.log(`[Import] Added ${fileType}.ics to ZIP (${events.length} events)`);
            continue;
          } else if (fileType === 'financials') {
            const receipts = await loadLocal<any[]>('@fin_receipts') ?? [];
            const statements = await loadLocal<any[]>('@fin_statements') ?? [];
            const winnings = await loadLocal<any[]>('@fin_winnings') ?? [];
            const pointsMap = (await loadLocal<Record<string, number>>('@fin_user_points_by_cruise')) ?? {};
            const byId: Record<string, any> = {};
            const ids = new Set<string>();
            receipts.forEach(r => { ids.add(r.cruiseId); byId[r.cruiseId] = byId[r.cruiseId] || {}; byId[r.cruiseId].receipt = r; });
            statements.forEach(s => { ids.add(s.cruiseId); byId[s.cruiseId] = byId[s.cruiseId] || {}; byId[s.cruiseId].statement = s; });
            winnings.forEach(w => { ids.add(w.cruiseId); byId[w.cruiseId] = byId[w.cruiseId] || {}; byId[w.cruiseId].winning = w; });
            const rows: any[] = [];
            ids.forEach((id) => {
              const r = byId[id].receipt;
              const s = byId[id].statement;
              if (!r && !s) return;
              const ship = r?.ship ?? s?.ship ?? '';
              const date = r?.departureDate ?? s?.departureDate ?? '';
              const retail = Number(r?.retailCabinValue ?? 0);
              const fare = Number(r?.fare ?? 0);
              const taxes = Number(r?.taxesAndFees ?? 0);
              const gratuities = Number(r?.gratuities ?? 0);
              const outOfPocket = fare + taxes + gratuities;
              const coinIn = Number(s?.clubRoyaleCoinIn ?? 0);
              const points = Number.isFinite(pointsMap[id]) ? Math.max(0, Math.floor(pointsMap[id])) : Math.floor((coinIn ?? 0) / 5);
              const win = Number(byId[id].winning?.amountBroughtHome ?? 0);
              const extras = Array.isArray(s?.extras) ? s.extras.reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0) : 0;
              const totalValueBack = retail + win + extras;
              const roi = outOfPocket > 0 ? (totalValueBack / outOfPocket) * 100 : 0;
              rows.push({
                cruiseId: id,
                ship,
                departureDate: date,
                retailCabinValue: retail,
                outOfPocket,
                coinIn,
                pointsEarned: points,
                winningsBroughtHome: win,
                extrasValue: extras,
                totalValueBack,
                roiPercent: Math.round(roi * 100) / 100,
              });
            });
            data = rows;
            fileName = 'financials.xlsx';
          } else if (fileType === 'userProfile') {
            const name = currentUser?.name ?? 'Me';
            const storedLoyaltyPts = await AsyncStorage.getItem('@loyalty_points');
            const storedUserPts = await AsyncStorage.getItem('@user_points');
            const storedClub = await AsyncStorage.getItem('@club_royale_profile');
            const profile = storedClub ? JSON.parse(storedClub) : null;
            const crownAnchorNumber = profile?.crownAnchorNumber ?? profile?.memberNumber ?? '';
            data = [{
              name,
              crownAnchorNumber,
              loyaltyPoints: storedLoyaltyPts ? parseInt(storedLoyaltyPts, 10) : (loyaltyPoints ?? 0),
              clubRoyalePoints: storedUserPts ? parseInt(storedUserPts, 10) : (userPoints ?? 0),
            }];
            fileName = 'userProfile.xlsx';
          }

          if (data.length > 0) {
            const wbout = xlsxFromJson(data, fileType === 'financials' ? 'Analytics' : fileType);
            zip.file(fileName, Uint8Array.from(atob(wbout), c => c.charCodeAt(0)));
            filesAdded++;
            console.log(`[Import] Added ${fileName} to ZIP (${data.length} records)`);
          }
        } catch (fileError: any) {
          console.warn(`[Import] Could not add ${fileType} to ZIP:`, fileError.message);
        }
      }
      
      if (filesAdded === 0) {
        Alert.alert('No Data', 'No data available to export in ZIP bundle.');
        return;
      }
      
      const zipBlob = await zip.generateAsync({ type: 'base64' });
      const fileName = `cruise-data-bundle-${new Date().toISOString().split('T')[0]}.zip`;
      
      if (Platform.OS === 'web') {
        const blob = new Blob(
          [Uint8Array.from(atob(zipBlob), c => c.charCodeAt(0))],
          { type: 'application/zip' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        
        Alert.alert('Export Complete', `${fileName} has been downloaded with ${filesAdded} files.`);
      } else {
        const FileSystem = require('expo-file-system');
        const Sharing = require('expo-sharing');
        
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, zipBlob, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/zip',
            dialogTitle: 'Export ZIP Bundle',
            UTI: 'public.zip-archive'
          });
        } else {
          Alert.alert('Export Complete', `File saved to: ${fileUri}`);
        }
      }
      
      console.log(`[Import] Successfully exported ZIP bundle with ${filesAdded} files`);
      setExportedCounts(prev => ({ ...prev, zipBundle: filesAdded }));
      
    } catch (error: any) {
      console.error('[Import] ZIP export error:', error);
      Alert.alert('Export Failed', `Failed to export ZIP bundle: ${error.message}`);
    } finally {
      setExportingFile(null);
    }
  };

  const handleExportFile = async (fileType: FileType) => {
    try {
      setExportingFile(fileType);
      console.log(`[Import] Exporting ${fileType} file...`);
      
      let data: any[] = [];
      let fileName = '';
      if (fileType === 'offersCsv') {
        const offers = await loadLocal<any[]>('@local_offers') ?? [];
        const cruises = await loadLocal<any[]>('@local_cruises') ?? [];
        const nameByCode = new Map<string, string>();
        const tradeInByCode = new Map<string, string>();
        const expiresByCode = new Map<string, string>();
        offers.forEach((o: any) => {
          const code = String(o.offerCode || '').trim();
          if (code) {
            nameByCode.set(code, o.offerName || o.name || '');
            tradeInByCode.set(code, o.tradeInValue || '');
            expiresByCode.set(code, o.expires || '');
          }
        });
        const rows: any[] = [];
        const usedCruises = cruises.filter((c: any) => c.offerCode);
        usedCruises.forEach((c: any) => {
          const code = String(c.offerCode || '').trim();
          rows.push({
            Profile: currentUser?.name ?? 'Me',
            Code: code,
            Rcvd: '',
            Expires: expiresByCode.get(code) || c.offerExpireDate || '',
            Name: nameByCode.get(code) || c.offerName || '',
            Class: c.shipClass || '',
            Ship: c.ship || '',
            'Sail Date': c.departureDate || '',
            Departs: c.departurePort || '',
            Nights: c.nights ?? '',
            Destination: c.itineraryName || '',
            Category: c.cabinType || '',
            Guests: c.guests ?? '',
            Perks: tradeInByCode.get(code) || c.value || '',
          });
        });
        offers.forEach((o: any) => {
          const code = String(o.offerCode || '').trim();
          const already = rows.find(r => r.Code === code);
          if (!already) {
            rows.push({
              Profile: currentUser?.name ?? 'Me',
              Code: code,
              Rcvd: '',
              Expires: o.expires || '',
              Name: o.offerName || o.name || '',
              Class: '',
              Ship: (o.ships && o.ships[0]) || '',
              'Sail Date': (o.sailingDates && o.sailingDates[0]) || '',
              Departs: '',
              Nights: '',
              Destination: '',
              Category: '',
              Guests: '',
              Perks: o.tradeInValue || '',
            });
          }
        });
        if (rows.length === 0) {
          Alert.alert('No Data', 'No offers or cruises with offer codes to export.');
          setExportingFile(null);
          return;
        }
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Offers');
        const csvOut = XLSX.write(wb, { type: 'base64', bookType: 'csv' });
        const outName = 'Offers.csv';
        if (Platform.OS === 'web') {
          const blob = new Blob([
            Uint8Array.from(atob(csvOut), c => c.charCodeAt(0))
          ], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url; link.download = outName; link.click(); URL.revokeObjectURL(url);
          Alert.alert('Export Complete', `${outName} has been downloaded.`);
        } else {
          const FileSystem = require('expo-file-system');
          const Sharing = require('expo-sharing');
          const fileUri = `${FileSystem.documentDirectory}${outName}`;
          await FileSystem.writeAsStringAsync(fileUri, csvOut, { encoding: FileSystem.EncodingType.Base64 });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Offers.CSV' });
          } else {
            Alert.alert('Export Complete', `File saved to: ${fileUri}`);
          }
        }
        setExportedCounts(prev => ({ ...prev, offersCsv: rows.length }));
        return;
      }
      
      if (fileType === 'cruises') {
        const cruises = await loadLocal<any[]>('@local_cruises') ?? [];
        data = cruises.map(mapCruiseForExport);
        fileName = 'cruises.xlsx';
      } else if (fileType === 'booked') {
        console.log('[Import] Exporting booked + completed cruises');
        const bookedStored = await AsyncStorage.getItem('@local_booked');
        const bookedData = bookedStored ? JSON.parse(bookedStored) : [];
        const cruises = await loadLocal<any[]>('@local_cruises') ?? [];
        const completed = cruises.filter((c: any) => (c.status || '').toString().toLowerCase() === 'completed');
        data = [...bookedData, ...completed];
        if (data.length === 0) {
          Alert.alert('No Data', 'No booked/completed cruises found to export.');
          return;
        }
        fileName = 'booked.xlsx';
      } else if (fileType === 'financials') {
        const receipts = await loadLocal<any[]>('@fin_receipts') ?? [];
        const statements = await loadLocal<any[]>('@fin_statements') ?? [];
        const winnings = await loadLocal<any[]>('@fin_winnings') ?? [];
        const pointsMap = (await loadLocal<Record<string, number>>('@fin_user_points_by_cruise')) ?? {};
        const byId: Record<string, any> = {};
        const ids = new Set<string>();
        receipts.forEach((r: any) => { ids.add(r.cruiseId); byId[r.cruiseId] = byId[r.cruiseId] || {}; byId[r.cruiseId].receipt = r; });
        statements.forEach((s: any) => { ids.add(s.cruiseId); byId[s.cruiseId] = byId[s.cruiseId] || {}; byId[s.cruiseId].statement = s; });
        winnings.forEach((w: any) => { ids.add(w.cruiseId); byId[w.cruiseId] = byId[w.cruiseId] || {}; byId[w.cruiseId].winning = w; });
        const rows: any[] = [];
        ids.forEach((id) => {
          const r = byId[id].receipt; const s = byId[id].statement; if (!r && !s) return;
          const ship = r?.ship ?? s?.ship ?? '';
          const date = r?.departureDate ?? s?.departureDate ?? '';
          const retail = Number(r?.retailCabinValue ?? 0);
          const fare = Number(r?.fare ?? 0);
          const taxes = Number(r?.taxesAndFees ?? 0);
          const gratuities = Number(r?.gratuities ?? 0);
          const outOfPocket = fare + taxes + gratuities;
          const coinIn = Number(s?.clubRoyaleCoinIn ?? 0);
          const points = Number.isFinite(pointsMap[id]) ? Math.max(0, Math.floor(pointsMap[id])) : Math.floor((coinIn ?? 0) / 5);
          const win = Number(byId[id].winning?.amountBroughtHome ?? 0);
          const extras = Array.isArray(s?.extras) ? s.extras.reduce((sum: number, it: any) => sum + (Number(it.amount) || 0), 0) : 0;
          const totalValueBack = retail + win + extras;
          const roi = outOfPocket > 0 ? (totalValueBack / outOfPocket) * 100 : 0;
          rows.push({ cruiseId: id, ship, departureDate: date, retailCabinValue: retail, outOfPocket, coinIn, pointsEarned: points, winningsBroughtHome: win, extrasValue: extras, totalValueBack, roiPercent: Math.round(roi * 100) / 100 });
        });
        if (rows.length === 0) {
          Alert.alert('No Data', 'No financials found to export.');
          return;
        }
        data = rows;
        fileName = 'financials.xlsx';
      } else if (fileType === 'userProfile') {
        const storedUserPts = await AsyncStorage.getItem('@user_points');
        const storedLoyaltyPts = await AsyncStorage.getItem('@loyalty_points');
        const storedClub = await AsyncStorage.getItem('@club_royale_profile');
        const profile = storedClub ? JSON.parse(storedClub) : null;
        const name = currentUser?.name ?? 'Me';
        const crownAnchorNumber = profile?.crownAnchorNumber ?? profile?.memberNumber ?? '';
        data = [{
          name,
          crownAnchorNumber,
          loyaltyPoints: storedLoyaltyPts ? parseInt(storedLoyaltyPts, 10) : (loyaltyPoints ?? 0),
          clubRoyalePoints: storedUserPts ? parseInt(storedUserPts, 10) : (userPoints ?? 0),
        }];
        fileName = 'userProfile.xlsx';
      } else if (fileType === 'offers') {
        const stored = await AsyncStorage.getItem('@local_offers');
        if (stored) {
          data = JSON.parse(stored);
          fileName = 'offers.xlsx';
        } else {
          Alert.alert('No Data', 'No offers data found to export.');
          return;
        }
      } else if (fileType === 'tripit' || fileType === 'calendar') {
        const events = await loadLocal<any[]>(`@local_${fileType}`) ?? [];
        if (events.length === 0) {
          Alert.alert('No Data', `No ${fileType} events found to export.`);
          return;
        }
        const ics = toICSFile(events, fileType === 'tripit' ? 'TripIt' : 'Calendar');
        const outName = `${fileType}.ics`;
        if (Platform.OS === 'web') {
          const blob = new Blob([ics], { type: 'text/calendar' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url; link.download = outName; link.click(); URL.revokeObjectURL(url);
          Alert.alert('Export Complete', `${outName} has been downloaded.`);
        } else {
          const FileSystem = require('expo-file-system');
          const Sharing = require('expo-sharing');
          const fileUri = `${FileSystem.documentDirectory}${outName}`;
          await FileSystem.writeAsStringAsync(fileUri, ics, { encoding: FileSystem.EncodingType.UTF8 });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, { mimeType: 'text/calendar', dialogTitle: `Export ${fileType}` });
          } else {
            Alert.alert('Export Complete', `File saved to: ${fileUri}`);
          }
        }
        setExportedCounts(prev => ({ ...prev, [fileType]: events.length }));
        return;
      } else if (fileType === 'zipBundle') {
        const storageKey = `@local_${fileType}`;
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          data = JSON.parse(stored);
          fileName = `${fileType}.xlsx`;
        } else {
          Alert.alert('No Data', `No ${fileType} data found to export.`);
          return;
        }
      } else if (fileType === 'zipBundle') {
        Alert.alert('Invalid Export', 'ZIP bundle export should use handleExportZipBundle instead.');
        return;
      }
      
      if (data.length === 0) {
        Alert.alert('No Data', `No ${fileType} data available to export.`);
        return;
      }
      
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, fileType === 'financials' ? 'Analytics' : fileType);
      
      const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      
      if (Platform.OS === 'web') {
        const blob = new Blob(
          [Uint8Array.from(atob(wbout), c => c.charCodeAt(0))],
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        
        Alert.alert('Export Complete', `${fileName} has been downloaded.`);
      } else {
        const FileSystem = require('expo-file-system');
        const Sharing = require('expo-sharing');
        
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, wbout, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: `Export ${fileType}`,
            UTI: 'com.microsoft.excel.xlsx'
          });
        } else {
          Alert.alert('Export Complete', `File saved to: ${fileUri}`);
        }
      }
      
      console.log(`[Import] Successfully exported ${data.length} ${fileType} records`);
      
      setExportedCounts(prev => ({ ...prev, [fileType]: data.length }));
      
    } catch (error: any) {
      console.error(`[Import] Export error for ${fileType}:`, error);
      Alert.alert('Export Failed', `Failed to export ${fileType}: ${error.message}`);
    } finally {
      setExportingFile(null);
    }
  };

  return (
    <ScrollView style={styles.container}>

      <View style={styles.headerBar}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
          testID="import-back-button"
        >
          <ArrowLeft size={18} color="#111827" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>



      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Import & Export Data Files</Text>
        <Text style={styles.helperText}>
          Each file can be imported or exported independently. Load files to import data, Save files to export current data.
        </Text>
        
        <View style={styles.fileRowsContainer}>
          <View style={styles.fileRow}>
            <Text style={styles.fileRowLabel}>Cruises</Text>
            <View style={styles.fileRowButtons}>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniLoadButton, selectedFiles.cruises && styles.miniLoadButtonSelected]}
                onPress={() => handleFileUpload('cruises')}
              >
                {selectedFiles.cruises ? (
                  <Check size={16} color="#22C55E" />
                ) : (
                  <FileUp size={16} color="#6C5CE7" />
                )}
                <Text style={[styles.miniButtonText, selectedFiles.cruises && styles.miniLoadButtonTextSelected]}>Load</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniExportButton, exportingFile === 'cruises' && styles.miniButtonDisabled]}
                onPress={() => handleExportFile('cruises')}
                disabled={exportingFile !== null}
              >
                {exportingFile === 'cruises' ? (
                  <ActivityIndicator size="small" color="#6C5CE7" />
                ) : (
                  <Download size={16} color="#6C5CE7" />
                )}
                <Text style={styles.miniButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fileRow}>
            <Text style={styles.fileRowLabel}>Booked</Text>
            <View style={styles.fileRowButtons}>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniLoadButton, selectedFiles.booked && styles.miniLoadButtonSelected]}
                onPress={() => handleFileUpload('booked')}
              >
                {selectedFiles.booked ? (
                  <Check size={16} color="#22C55E" />
                ) : (
                  <FileUp size={16} color="#6C5CE7" />
                )}
                <Text style={[styles.miniButtonText, selectedFiles.booked && styles.miniLoadButtonTextSelected]}>Load</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniExportButton, exportingFile === 'booked' && styles.miniButtonDisabled]}
                onPress={() => handleExportFile('booked')}
                disabled={exportingFile !== null}
              >
                {exportingFile === 'booked' ? (
                  <ActivityIndicator size="small" color="#6C5CE7" />
                ) : (
                  <Download size={16} color="#6C5CE7" />
                )}
                <Text style={styles.miniButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fileRow}>
            <Text style={styles.fileRowLabel}>Offers</Text>
            <View style={styles.fileRowButtons}>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniLoadButton, selectedFiles.offers && styles.miniLoadButtonSelected]}
                onPress={() => handleFileUpload('offers')}
              >
                {selectedFiles.offers ? (
                  <Check size={16} color="#22C55E" />
                ) : (
                  <FileUp size={16} color="#6C5CE7" />
                )}
                <Text style={[styles.miniButtonText, selectedFiles.offers && styles.miniLoadButtonTextSelected]}>Load</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniExportButton, exportingFile === 'offers' && styles.miniButtonDisabled]}
                onPress={() => handleExportFile('offers')}
                disabled={exportingFile !== null}
              >
                {exportingFile === 'offers' ? (
                  <ActivityIndicator size="small" color="#6C5CE7" />
                ) : (
                  <Download size={16} color="#6C5CE7" />
                )}
                <Text style={styles.miniButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fileRow}>
            <Text style={styles.fileRowLabel}>Offers.CSV</Text>
            <View style={styles.fileRowButtons}>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniLoadButton, selectedFiles.offersCsv && styles.miniLoadButtonSelected]}
                onPress={() => handleFileUpload('offersCsv')}
              >
                {selectedFiles.offersCsv ? (
                  <Check size={16} color="#22C55E" />
                ) : (
                  <FileUp size={16} color="#6C5CE7" />
                )}
                <Text style={[styles.miniButtonText, selectedFiles.offersCsv && styles.miniLoadButtonTextSelected]}>Load</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniExportButton, exportingFile === 'offersCsv' && styles.miniButtonDisabled]}
                onPress={() => handleExportFile('offersCsv')}
                disabled={exportingFile !== null}
              >
                {exportingFile === 'offersCsv' ? (
                  <ActivityIndicator size="small" color="#6C5CE7" />
                ) : (
                  <Download size={16} color="#6C5CE7" />
                )}
                <Text style={styles.miniButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fileRow}>
            <Text style={styles.fileRowLabel}>TripIt</Text>
            <View style={styles.fileRowButtons}>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniLoadButton, selectedFiles.tripit && styles.miniLoadButtonSelected]}
                onPress={() => handleFileUpload('tripit')}
              >
                {selectedFiles.tripit ? (
                  <Check size={16} color="#22C55E" />
                ) : (
                  <FileUp size={16} color="#6C5CE7" />
                )}
                <Text style={[styles.miniButtonText, selectedFiles.tripit && styles.miniLoadButtonTextSelected]}>Load</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniExportButton, exportingFile === 'tripit' && styles.miniButtonDisabled]}
                onPress={() => handleExportFile('tripit')}
                disabled={exportingFile !== null}
              >
                {exportingFile === 'tripit' ? (
                  <ActivityIndicator size="small" color="#6C5CE7" />
                ) : (
                  <Download size={16} color="#6C5CE7" />
                )}
                <Text style={styles.miniButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fileRow}>
            <Text style={styles.fileRowLabel}>Calendar</Text>
            <View style={styles.fileRowButtons}>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniLoadButton, selectedFiles.calendar && styles.miniLoadButtonSelected]}
                onPress={() => handleFileUpload('calendar')}
              >
                {selectedFiles.calendar ? (
                  <Check size={16} color="#22C55E" />
                ) : (
                  <FileUp size={16} color="#6C5CE7" />
                )}
                <Text style={[styles.miniButtonText, selectedFiles.calendar && styles.miniLoadButtonTextSelected]}>Load</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniExportButton, exportingFile === 'calendar' && styles.miniButtonDisabled]}
                onPress={() => handleExportFile('calendar')}
                disabled={exportingFile !== null}
              >
                {exportingFile === 'calendar' ? (
                  <ActivityIndicator size="small" color="#6C5CE7" />
                ) : (
                  <Download size={16} color="#6C5CE7" />
                )}
                <Text style={styles.miniButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fileRow}>
            <Text style={styles.fileRowLabel}>Financials</Text>
            <View style={styles.fileRowButtons}>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniLoadButton, selectedFiles.financials && styles.miniLoadButtonSelected]}
                onPress={() => handleFileUpload('financials')}
              >
                {selectedFiles.financials ? (
                  <Check size={16} color="#22C55E" />
                ) : (
                  <FileUp size={16} color="#6C5CE7" />
                )}
                <Text style={[styles.miniButtonText, selectedFiles.financials && styles.miniLoadButtonTextSelected]}>Load</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniExportButton, exportingFile === 'financials' && styles.miniButtonDisabled]}
                onPress={() => handleExportFile('financials')}
                disabled={exportingFile !== null}
              >
                {exportingFile === 'financials' ? (
                  <ActivityIndicator size="small" color="#6C5CE7" />
                ) : (
                  <Download size={16} color="#6C5CE7" />
                )}
                <Text style={styles.miniButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fileRow}>
            <Text style={styles.fileRowLabel}>User Profile</Text>
            <View style={styles.fileRowButtons}>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniLoadButton, selectedFiles.userProfile && styles.miniLoadButtonSelected]}
                onPress={() => handleFileUpload('userProfile')}
              >
                {selectedFiles.userProfile ? (
                  <Check size={16} color="#22C55E" />
                ) : (
                  <FileUp size={16} color="#6C5CE7" />
                )}
                <Text style={[styles.miniButtonText, selectedFiles.userProfile && styles.miniLoadButtonTextSelected]}>Load</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniExportButton, exportingFile === 'userProfile' && styles.miniButtonDisabled]}
                onPress={() => handleExportFile('userProfile')}
                disabled={exportingFile !== null}
              >
                {exportingFile === 'userProfile' ? (
                  <ActivityIndicator size="small" color="#6C5CE7" />
                ) : (
                  <Download size={16} color="#6C5CE7" />
                )}
                <Text style={styles.miniButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.helperTextContainer}>
            <Text style={styles.exportHelperTitle}>💡 Quick Export Access</Text>
            <Text style={styles.exportHelperText}>
              Use the "Save" buttons above to export any file. All files will be automatically exported to your device in the most recent format.
            </Text>
            <Text style={styles.exportHelperText}>
              Files available: cruises.xlsx, booked.xlsx, offers.xlsx, calendar.ics, tripit.ics, financials.xlsx, userProfile.xlsx, Offers.CSV
            </Text>
          </View>

          <View style={[styles.fileRow, styles.fileRowHighlight]}>
            <Text style={[styles.fileRowLabel, styles.fileRowLabelHighlight]}>ZIP Bundle (All 7)</Text>
            <View style={styles.fileRowButtons}>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniLoadButtonZip, selectedFiles.zipBundle && styles.miniLoadButtonSelected]}
                onPress={() => handleFileUpload('zipBundle')}
              >
                {selectedFiles.zipBundle ? (
                  <Check size={16} color="#FFFFFF" />
                ) : (
                  <Archive size={16} color="#FFFFFF" />
                )}
                <Text style={[styles.miniButtonText, styles.miniButtonTextWhite]}>Load</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniButton, styles.miniExportButtonZip, exportingFile === 'zipBundle' && styles.miniButtonDisabled]}
                onPress={() => handleExportZipBundle()}
                disabled={exportingFile !== null}
              >
                {exportingFile === 'zipBundle' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Archive size={16} color="#FFFFFF" />
                )}
                <Text style={[styles.miniButtonText, styles.miniButtonTextWhite]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>



      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={loadPreview}
          disabled={loading}
          testID="load-preview-button"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <FileUp size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Load Preview</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {previewData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Preview</Text>
          
          {previewData.cruises && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Cruises</Text>
              <Text style={styles.previewText}>
                {exportedCounts.cruises 
                  ? `Saved ${exportedCounts.cruises} cruises` 
                  : `${previewData.cruises.length} rows detected`}
              </Text>
            </View>
          )}
          
          {previewData.booked && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Booked Cruises</Text>
              <Text style={styles.previewText}>
                {exportedCounts.booked 
                  ? `Saved ${exportedCounts.booked} booked cruises` 
                  : `${previewData.booked.length} rows detected`}
              </Text>
            </View>
          )}
          
          {previewData.offers && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Casino Offers</Text>
              <Text style={styles.previewText}>
                {exportedCounts.offers 
                  ? `Saved ${exportedCounts.offers} offers` 
                  : `${previewData.offers.length} rows detected`}
              </Text>
            </View>
          )}
          
          {previewData.tripit && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>TripIt Events</Text>
              <Text style={styles.previewText}>
                {exportedCounts.tripit 
                  ? `Saved ${exportedCounts.tripit} events` 
                  : `${previewData.tripit.length} rows detected`}
              </Text>
            </View>
          )}

          {previewData.calendar && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Calendar Events</Text>
              <Text style={styles.previewText}>
                {exportedCounts.calendar 
                  ? `Saved ${exportedCounts.calendar} events` 
                  : `${previewData.calendar.length} rows detected`}
              </Text>
            </View>
          )}
          
          {previewData.financials && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Financials (Analytics Master Cruises)</Text>
              <Text style={styles.previewText}>
                {exportedCounts.financials 
                  ? `Saved ${exportedCounts.financials} master cruises` 
                  : `${previewData.financials.length} rows detected`}
              </Text>
            </View>
          )}
          
          {previewData.userProfile && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>User Profile</Text>
              <Text style={styles.previewText}>
                {exportedCounts.userProfile 
                  ? `Saved ${exportedCounts.userProfile} profile records` 
                  : `${previewData.userProfile.length} rows detected`}
              </Text>
            </View>
          )}
          
          {exportedCounts.financials && !previewData.financials && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Financials (Analytics Master Cruises)</Text>
              <Text style={styles.previewText}>
                Saved {exportedCounts.financials} master cruises
              </Text>
            </View>
          )}
          
          {exportedCounts.userProfile && !previewData.userProfile && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>User Profile</Text>
              <Text style={styles.previewText}>
                Saved {exportedCounts.userProfile} profile records
              </Text>
            </View>
          )}
        </View>
      )}

      {previewData && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.localImportButton,
              (localImporting || loading) && styles.buttonDisabled,
            ]}
            onPress={handleLocalOnlyImport}
            disabled={localImporting || loading}
            testID="local-import-button"
          >
            {localImporting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <FileUp size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Save Locally (Offline)</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.resetButton, (localImporting || loading) && styles.buttonDisabled]}
            onPress={resetImportState}
            disabled={localImporting || loading}
            testID="reset-import-button"
          >
            <Text style={styles.buttonText}>Reset / Start Over</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  section: {
    padding: 16,
  },
  headerBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backButtonText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  helperText: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 16,
  },
  fileUploadContainer: {
    marginBottom: 12,
  },
  fileUploadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    borderStyle: "dashed",
  },
  fileUploadButtonSelected: {
    borderColor: "#22C55E",
    backgroundColor: "#F0FDF4",
    borderStyle: "solid",
  },
  fileUploadText: {
    fontSize: 14,
    color: "#6B7280",
    flex: 1,
  },
  fileUploadTextSelected: {
    color: "#15803D",
    fontWeight: "500",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6C5CE7",
    padding: 16,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  urlImportButton: {
    backgroundColor: "#4CAF50",
  },
  localImportButton: {
    backgroundColor: "#0EA5E9",
  },
  snapshotButton: {
    backgroundColor: "#8B5CF6",
  },
  tripItButton: {
    backgroundColor: "#F59E0B",
  },
  dataFolderButton: {
    backgroundColor: "#10B981",
  },
  loadSnapshotButton: {
    backgroundColor: "#0EA5E9",
  },
  clearDataButton: {
    backgroundColor: "#EF4444",
  },
  resetButton: {
    backgroundColor: "#6B7280",
    marginTop: 12,
  },
  warningBox: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  warningText: {
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
  },
  previewCard: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  previewText: {
    fontSize: 12,
    color: "#6B7280",
  },

  processDataFolderButton: {
    backgroundColor: "#8B5CF6",
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 12,
    gap: 16,
    marginBottom: 16,
  },
  processDataFolderContent: {
    flex: 1,
  },
  processDataFolderText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  processDataFolderSubtext: {
    color: "#FFFFFF",
    fontSize: 13,
    opacity: 0.9,
    lineHeight: 18,
  },
  scanDataFolderButton: {
    backgroundColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  scanDataFolderText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  exportButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#6C5CE7",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 100,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C5CE7",
  },
  exportButtonZip: {
    backgroundColor: "#8B5CF6",
    borderColor: "#8B5CF6",
  },
  exportButtonZipText: {
    color: "#FFFFFF",
  },
  helperTextContainer: {
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  exportHelperTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4C1D95",
    marginBottom: 8,
  },
  exportHelperText: {
    fontSize: 13,
    color: "#5B21B6",
    lineHeight: 20,
    marginBottom: 4,
  },
  loadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#6C5CE7",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 100,
  },
  loadButtonSelected: {
    borderColor: "#22C55E",
    backgroundColor: "#F0FDF4",
  },
  loadButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C5CE7",
  },
  loadButtonTextSelected: {
    color: "#22C55E",
    fontWeight: "600",
  },
  loadButtonZip: {
    backgroundColor: "#8B5CF6",
    borderColor: "#8B5CF6",
  },
  loadButtonZipText: {
    color: "#FFFFFF",
  },
  fileRowsContainer: {
    gap: 12,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  fileRowHighlight: {
    backgroundColor: "#F5F3FF",
    borderColor: "#8B5CF6",
  },
  fileRowLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  fileRowLabelHighlight: {
    color: "#8B5CF6",
  },
  fileRowButtons: {
    flexDirection: "row",
    gap: 8,
  },
  miniButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 70,
  },
  miniButtonDisabled: {
    opacity: 0.5,
  },
  miniButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6C5CE7",
  },
  miniButtonTextWhite: {
    color: "#FFFFFF",
  },
  miniLoadButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#6C5CE7",
  },
  miniLoadButtonSelected: {
    borderColor: "#22C55E",
    backgroundColor: "#F0FDF4",
  },
  miniLoadButtonTextSelected: {
    color: "#22C55E",
  },
  miniLoadButtonZip: {
    backgroundColor: "#8B5CF6",
    borderWidth: 1,
    borderColor: "#8B5CF6",
  },
  miniExportButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#6C5CE7",
  },
  miniExportButtonZip: {
    backgroundColor: "#8B5CF6",
    borderWidth: 1,
    borderColor: "#8B5CF6",
  },
});