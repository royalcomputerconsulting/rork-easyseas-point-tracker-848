import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,

} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { 
  Camera, 
  FileImage, 
  Receipt, 
  ArrowLeft,
  Upload,
  CheckCircle,
  AlertCircle,
  Zap,
  Target
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import XLSX from 'xlsx';
import { useAppState } from '@/state/AppStateProvider';
import { parseExcelData, validateOfferCode } from '@/lib/import';
import { trpc } from '@/lib/trpc';

type OCRType = 'offer-flyer' | 'casino-overview' | 'receipt' | 'smart-receipt' | 'smart-statement';

type PreviewRow = Record<string, any>;

interface OCRLocalResult {
  success: boolean;
  totalExtracted?: number;
  errors?: string[];
  previewRows?: PreviewRow[];
}

const STORAGE_KEYS = {
  LOCAL_CRUISES: '@local_cruises',
  LOCAL_BOOKED: '@local_booked',
  LOCAL_OFFERS: '@local_offers',
  LOCAL_LAST_IMPORT: '@local_last_import',
} as const;

export default function OCRScreen() {
  const params = useLocalSearchParams<{ type?: OCRType; offerCode?: string; offerName?: string }>();
  const [selectedType, setSelectedType] = useState<OCRType | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<OCRLocalResult | null>(null);
  const [offerCode, setOfferCode] = useState<string>('');
  const [offerName, setOfferName] = useState<string>('');

  useEffect(() => {
    try {
      const initialType = (params.type as OCRType | undefined) ?? null;
      if (initialType) {
        setSelectedType(initialType);
      }
      if (typeof params.offerCode === 'string') {
        setOfferCode(params.offerCode);
      }
      if (typeof params.offerName === 'string') {
        setOfferName(params.offerName);
      }
      console.log('[OCR] Initial params', params);
    } catch (e) {
      console.warn('[OCR] Failed to init from params', e);
    }
  }, [params]);
  const [selectedCruiseId, setSelectedCruiseId] = useState<string>('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imageCount, setImageCount] = useState<number>(0);
  const [pickedFiles, setPickedFiles] = useState<{ name: string; uri: string; mime?: string }[]>([]);
  const [autoDetectMode, setAutoDetectMode] = useState<boolean>(true);
  const [smartOcrResult, setSmartOcrResult] = useState<any>(null);

  const { localData, refreshLocalData } = useAppState();

  const cruisesForReceipt = useMemo(() => localData.cruises ?? [], [localData.cruises]);

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: selectedType === 'offer-flyer',
      });

      if (!res.canceled && res.assets.length > 0) {
        const base64s = res.assets.map(a => a.base64).filter(Boolean) as string[];
        if (selectedType === 'offer-flyer') {
          const next = [...selectedImages, ...base64s];
          setSelectedImages(next);
          setImageCount(next.length);
        } else if (base64s[0]) {
          await processImages([base64s[0]]);
        }
      }
    } catch (e) {
      console.error('[OCR] pickImage error', e);
      Alert.alert('Error', 'Failed to open image library');
    }
  };

  const takePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant permission to access your camera.');
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!res.canceled && res.assets[0]?.base64) {
        const base64 = res.assets[0].base64 as string;
        if (selectedType === 'offer-flyer') {
          const next = [...selectedImages, base64];
          setSelectedImages(next);
          setImageCount(next.length);
        } else {
          await processImages([base64]);
        }
      }
    } catch (e) {
      console.error('[OCR] takePhoto error', e);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const pickFilesXlsx = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        multiple: selectedType === 'offer-flyer',
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/pdf',
        ],
        copyToCacheDirectory: true,
      });

      if (res.canceled) return;
      const files = (res.assets ?? []) as Array<{ name?: string; uri?: string; mimeType?: string }>;
      const mapped = files.map(f => ({ name: String(f.name ?? 'file.xlsx'), uri: String(f.uri ?? ''), mime: String(f.mimeType ?? '') }));
      setPickedFiles(mapped);
      Alert.alert('File(s) ready', `${mapped.length} file(s) selected. Tap Load Preview.`);
    } catch (e) {
      console.error('[OCR] pickFilesXlsx error', e);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const readXlsxFromUri = async (uri: string): Promise<any[]> => {
    try {
      const resp = await fetch(uri);
      const blob = await resp.arrayBuffer();
      const wb = XLSX.read(blob);
      const firstSheet = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheet];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      return json as any[];
    } catch (e) {
      console.error('[OCR] readXlsxFromUri error', e);
      throw e;
    }
  };

  const processImages = async (imagesBase64: string[], isPdf: boolean = false) => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select a type first.');
      return;
    }
    setIsProcessing(true);
    setResult(null);

    try {
      const errors: string[] = [];
      const previews: PreviewRow[] = [];

      for (const b64 of imagesBase64) {
        try {
          let systemPrompt = '';
          let userPrompt = '';
          
          if (selectedType === 'offer-flyer') {
            systemPrompt = `You are a precise OCR system for cruise offer flyers${isPdf ? ' (PDF document)' : ''}. Extract ALL cruise information and return it as a JSON array.

IMPORTANT: Look for:
- Ship names (e.g., "Quantum of the Seas", "Navigator of the Seas")
- Itinerary details (e.g., "5 Night Cabo Overnight", "3 Night Ensenada")
- Departure dates (convert ALL to YYYY-MM-DD format)
- Cabin types (Interior, Balcony, etc.)
- Departure ports
- Offer codes and names

Each cruise should have this structure:
{
  "ship": "Ship Name",
  "itineraryName": "Itinerary description",
  "departurePort": "Port name",
  "departureDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD",
  "nights": number,
  "line": "Royal Caribbean" (or other),
  "cabinType": "Interior/Balcony/Suite",
  "offerCode": "${offerCode || 'from document'}",
  "offerName": "${offerName || 'from document'}",
  "expires": "YYYY-MM-DD" (if shown)
}

Extract EVERY cruise shown. Return ONLY a valid JSON array.`;
            userPrompt = `Extract all cruise data from this ${isPdf ? 'PDF' : 'image'} offer flyer. Get ALL cruises listed.`;
          } else if (selectedType === 'casino-overview') {
            systemPrompt = `You extract casino offers from ${isPdf ? 'PDF documents' : 'images'}. Return a JSON array with these keys: offerCode, offerName, offerType, expires, tradeInValue, description. Extract ALL offers shown.`;
            userPrompt = `Extract all casino offers from this ${isPdf ? 'PDF' : 'image'}. Return JSON array only.`;
          } else if (selectedType === 'receipt') {
            systemPrompt = `You extract booking receipt data from ${isPdf ? 'PDF documents' : 'images'}. Return a JSON array with: reservationNumber, ship, departureDate, returnDate, cabinType, paidFare, actualFare, guestName. Extract ALL bookings shown.`;
            userPrompt = `Extract all booking data from this ${isPdf ? 'PDF' : 'receipt image'}. Return JSON array only.`;
          } else {
            systemPrompt = 'You extract structured rows from casino flyer/overview/receipt images. Always return compact JSON array. Keys: ship, itineraryName, departurePort, nights, departureDate, offerCode, offerName, expires, reservationNumber, paidFare, actualFare.';
            userPrompt = `Type: ${selectedType}. OfferCode: ${offerCode}. OfferName: ${offerName}. Return JSON only.`;
          }
          
          const body = {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: [{ type: 'text', text: userPrompt }, { type: 'image', image: b64 }]},
            ],
          } as const;
          const r = await fetch('https://toolkit.rork.com/text/llm/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const j = await r.json();
          const text: string = j?.completion ?? '[]';
          const safeText = text.trim().startsWith('[') ? text : (text.match(/\[[\s\S]*\]/)?.[0] ?? '[]');
          const rows = JSON.parse(safeText) as PreviewRow[];
          previews.push(...rows);
        } catch (e) {
          console.error('[OCR] AI parse failed for one image', e);
          errors.push('Failed to parse one image');
        }
      }

      setResult({ success: errors.length === 0 || previews.length > 0, totalExtracted: previews.length, errors, previewRows: previews });
    } catch (e) {
      console.error('[OCR] processImages error', e);
      Alert.alert('Error', 'Failed to process images');
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdfMutation = trpc.ocr.pdf.useMutation();

  const onLoadPreview = async () => {
    try {
      if (!selectedType) {
        Alert.alert('Select Type', 'Choose Offer, Overview, or Receipt');
        return;
      }

      if (pickedFiles.length > 0) {
        setIsProcessing(true);
        const allRows: PreviewRow[] = [];
        const errors: string[] = [];
        
        for (const f of pickedFiles) {
          // Check if it's a PDF file
          if (f.mime?.includes('pdf') || f.name.toLowerCase().endsWith('.pdf')) {
            // For PDFs, we'll send them to the backend for processing
            console.log('[OCR] Processing PDF file:', f.name);
            
            // Convert PDF to base64 for processing
            try {
              const resp = await fetch(f.uri);
              const blob = await resp.blob();
              const reader = new FileReader();
              const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onloadend = () => {
                  const base64 = reader.result as string;
                  // Remove data URL prefix to get pure base64
                  const pureBase64 = base64.split(',')[1];
                  resolve(pureBase64);
                };
                reader.onerror = reject;
              });
              reader.readAsDataURL(blob);
              const pdfBase64 = await base64Promise;
              
              // Send PDF to backend for processing
              console.log('[OCR] Sending PDF to backend for processing...');
              const pdfResult = await processPdfMutation.mutateAsync({
                base64: pdfBase64,
                type: selectedType as 'offer-flyer' | 'casino-overview' | 'receipt',
                offerCode: offerCode || undefined,
                offerName: offerName || undefined,
                fileName: f.name
              });
              
              if (pdfResult.success && pdfResult.rows) {
                console.log(`[OCR] Backend extracted ${pdfResult.rows.length} rows from PDF`);
                allRows.push(...pdfResult.rows);
              } else {
                console.error('[OCR] PDF processing failed:', pdfResult.error);
                errors.push(pdfResult.error || `Failed to process PDF: ${f.name}`);
              }
            } catch (pdfError) {
              console.error('[OCR] Failed to process PDF:', pdfError);
              errors.push(`Failed to process PDF file: ${f.name}`);
            }
          } else {
            // Process XLSX files as before
            const rows = await readXlsxFromUri(f.uri);
            let parsed: any[] = [];
            if (selectedType === 'offer-flyer') parsed = parseExcelData(rows, 'cruises', false) as any[];
            if (selectedType === 'casino-overview') parsed = parseExcelData(rows, 'offers', false) as any[];
            if (selectedType === 'receipt') parsed = parseExcelData(rows, 'booked', false) as any[];
            allRows.push(...parsed);
          }
        }
        
        // Set results
        if (allRows.length > 0 || errors.length > 0) {
          setResult({ 
            success: allRows.length > 0, 
            totalExtracted: allRows.length, 
            previewRows: allRows,
            errors: errors.length > 0 ? errors : undefined
          });
        } else {
          setResult({
            success: false,
            totalExtracted: 0,
            errors: ['No data extracted from files']
          });
        }
      } else if (selectedImages.length > 0) {
        await processImages(selectedImages);
      } else {
        Alert.alert('Nothing to preview', 'Pick photos or files first.');
      }
    } catch (e) {
      console.error('[OCR] onLoadPreview error', e);
      Alert.alert('Error', 'Failed to load preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveLocally = async () => {
    try {
      if (!result?.previewRows || result.previewRows.length === 0) {
        Alert.alert('No data', 'Load Preview first.');
        return;
      }

      if (!selectedType) return;

      if (selectedType === 'offer-flyer') {
        const existingCruisesStr = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_CRUISES);
        const existingCruises = existingCruisesStr ? JSON.parse(existingCruisesStr) : [];
        const nextCruises = [...existingCruises, ...result.previewRows];
        await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_CRUISES, JSON.stringify(nextCruises));

        // Also upsert a corresponding casino offer so it appears on the Offers page and links to these cruises
        const code = (offerCode || (result.previewRows[0]?.offerCode ?? '')).toString().trim();
        const name = (offerName || (result.previewRows[0]?.offerName ?? '')).toString().trim();
        const expiresRaw = result.previewRows.find(r => r.expires || r.offerExpireDate)?.expires || result.previewRows.find(r => r.offerExpireDate)?.offerExpireDate || '';
        const expires = typeof expiresRaw === 'string' && expiresRaw.length > 0 ? expiresRaw : new Date(Date.now() + 90*24*60*60*1000).toISOString().split('T')[0];
        if (code || name) {
          const offersStr = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_OFFERS);
          const offers: any[] = offersStr ? JSON.parse(offersStr) : [];
          const makeId = (c: string, e: string, n: string) => `offer_${(c||'NA').toUpperCase()}_${(e||'NA')}_${n.replace(/\s+/g,'_')}`;
          const id = makeId(code, expires, name || 'Unnamed');
          const upserted = { id, offerCode: code, offerName: name || 'Offer', offerType: 'Cruise Offer', expires, tradeInValue: '$0' };
          const idx = offers.findIndex(o => (o.id ?? '') === id || ((o.offerCode ?? '').toString().toUpperCase() === code.toUpperCase() && (o.expires ?? '') === expires));
          if (idx >= 0) {
            offers[idx] = { ...offers[idx], ...upserted };
          } else {
            offers.push(upserted);
          }
          await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_OFFERS, JSON.stringify(offers));
        }
      } else if (selectedType === 'casino-overview') {
        const filtered = result.previewRows.filter(r => typeof r.offerCode === 'string' ? validateOfferCode(String(r.offerCode)) : true).map((r: any) => {
          const code = (r.offerCode ?? '').toString().trim();
          const expires = (r.expires ?? '').toString().trim();
          const name = (r.offerName ?? r['OFFER NAME'] ?? r['Offer Name'] ?? '').toString();
          const makeId = (c: string, e: string, n: string) => `offer_${(c||'NA').toUpperCase()}_${(e||'NA')}_${n.replace(/\s+/g,'_')}`;
          const id = r.id || makeId(code, expires, name || 'Unnamed');
          return { id, ...r, offerCode: code, expires };
        });
        const existingStr = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_OFFERS);
        const existing = existingStr ? JSON.parse(existingStr) : [];
        const next = [...existing, ...filtered];
        await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_OFFERS, JSON.stringify(next));
      } else if (selectedType === 'receipt') {
        const existingStr = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_BOOKED);
        const existing = existingStr ? JSON.parse(existingStr) : [];
        const next = [...existing, ...result.previewRows];
        await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_BOOKED, JSON.stringify(next));
      }

      await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_LAST_IMPORT, new Date().toISOString());
      await refreshLocalData();

      Alert.alert('Saved', 'Data saved on device. You can sync later.');
      setSelectedImages([]);
      setImageCount(0);
      setPickedFiles([]);
      setResult(null);
    } catch (e) {
      console.error('[OCR] saveLocally error', e);
      Alert.alert('Save Failed', 'Could not save locally');
    }
  };

  const renderTypeSelector = () => (
    <View style={styles.typeSelector}>
      <Text style={styles.sectionTitle}>Select Type</Text>
      
      {/* Smart OCR Options */}
      <View style={styles.smartOcrSection}>
        <Text style={styles.smartOcrTitle}>🤖 Smart OCR (Auto-Create Cruises)</Text>
        <Text style={styles.smartOcrDescription}>Automatically finds or creates cruises from your documents</Text>
        
        <TouchableOpacity
          style={[styles.typeButton, styles.smartTypeButton, selectedType === 'smart-receipt' && styles.typeButtonActive]}
          onPress={() => setSelectedType('smart-receipt')}
          testID="ocr-type-smart-receipt"
        >
          <Zap size={24} color={selectedType === 'smart-receipt' ? '#FFFFFF' : '#10B981'} />
          <View style={styles.typeButtonContent}>
            <Text style={[styles.typeButtonTitle, selectedType === 'smart-receipt' && styles.typeButtonTitleActive]}>Smart Receipt</Text>
            <Text style={[styles.typeButtonDescription, selectedType === 'smart-receipt' && styles.typeButtonDescriptionActive]}>Auto-detects cruise and creates if needed</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeButton, styles.smartTypeButton, selectedType === 'smart-statement' && styles.typeButtonActive]}
          onPress={() => setSelectedType('smart-statement')}
          testID="ocr-type-smart-statement"
        >
          <Zap size={24} color={selectedType === 'smart-statement' ? '#FFFFFF' : '#10B981'} />
          <View style={styles.typeButtonContent}>
            <Text style={[styles.typeButtonTitle, selectedType === 'smart-statement' && styles.typeButtonTitleActive]}>Smart Statement</Text>
            <Text style={[styles.typeButtonDescription, selectedType === 'smart-statement' && styles.typeButtonDescriptionActive]}>Auto-detects cruise and creates if needed</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Traditional OCR Options */}
      <View style={styles.traditionalOcrSection}>
        <Text style={styles.traditionalOcrTitle}>📋 Traditional OCR (Local Storage)</Text>
        
        <TouchableOpacity
          style={[styles.typeButton, selectedType === 'offer-flyer' && styles.typeButtonActive]}
          onPress={() => setSelectedType('offer-flyer')}
          testID="ocr-type-offer-flyer"
        >
          <FileImage size={24} color={selectedType === 'offer-flyer' ? '#FFFFFF' : '#6C5CE7'} />
          <View style={styles.typeButtonContent}>
            <Text style={[styles.typeButtonTitle, selectedType === 'offer-flyer' && styles.typeButtonTitleActive]}>Offer Flyer</Text>
            <Text style={[styles.typeButtonDescription, selectedType === 'offer-flyer' && styles.typeButtonDescriptionActive]}>XLSX, PDF, or Photos. Ask for Offer Code/Name.</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeButton, selectedType === 'casino-overview' && styles.typeButtonActive]}
          onPress={() => setSelectedType('casino-overview')}
          testID="ocr-type-casino-overview"
        >
          <Receipt size={24} color={selectedType === 'casino-overview' ? '#FFFFFF' : '#6C5CE7'} />
          <View style={styles.typeButtonContent}>
            <Text style={[styles.typeButtonTitle, selectedType === 'casino-overview' && styles.typeButtonTitleActive]}>Casino Overview</Text>
            <Text style={[styles.typeButtonDescription, selectedType === 'casino-overview' && styles.typeButtonDescriptionActive]}>Photos, XLSX, or PDF of overview offers</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeButton, selectedType === 'receipt' && styles.typeButtonActive]}
          onPress={() => setSelectedType('receipt')}
          testID="ocr-type-receipt"
        >
          <Receipt size={24} color={selectedType === 'receipt' ? '#FFFFFF' : '#6C5CE7'} />
          <View style={styles.typeButtonContent}>
            <Text style={[styles.typeButtonTitle, selectedType === 'receipt' && styles.typeButtonTitleActive]}>Receipt</Text>
            <Text style={[styles.typeButtonDescription, selectedType === 'receipt' && styles.typeButtonDescriptionActive]}>Photos, XLSX, or PDF of booking receipts</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderInputFields = () => {
    if (!selectedType) return null;

    return (
      <View style={styles.inputSection}>
        {selectedType === 'offer-flyer' && (
          <>
            <Text style={styles.inputLabel}>Offer Details</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Offer Code (e.g., 25SEP106)"
              value={offerCode}
              onChangeText={setOfferCode}
              testID="offer-code-input"
            />
            <TextInput
              style={styles.textInput}
              placeholder="Offer Name (e.g., Fall Special)"
              value={offerName}
              onChangeText={setOfferName}
              testID="offer-name-input"
            />
          </>
        )}

        {selectedType === 'receipt' && (
          <>
            <Text style={styles.inputLabel}>Select Cruise for Receipt</Text>
            <ScrollView style={styles.cruiseSelector} horizontal showsHorizontalScrollIndicator={false}>
              {cruisesForReceipt.map((cruise: any) => (
                <TouchableOpacity
                  key={cruise.id ?? `${cruise.ship}-${cruise.departureDate}`}
                  style={[styles.cruiseOption, selectedCruiseId === (cruise.id ?? '') && styles.cruiseOptionActive]}
                  onPress={() => setSelectedCruiseId(String(cruise.id ?? ''))}
                  testID={`cruise-option-${cruise.id ?? 'local'}`}
                >
                  <Text style={[styles.cruiseOptionText, selectedCruiseId === (cruise.id ?? '') && styles.cruiseOptionTextActive]}>
                    {cruise.ship}
                  </Text>
                  <Text style={[styles.cruiseOptionDate, selectedCruiseId === (cruise.id ?? '') && styles.cruiseOptionDateActive]}>
                    {cruise.departureDate ? new Date(cruise.departureDate).toLocaleDateString() : 'TBD'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    );
  };

  const receiptMutation = trpc.ocr.receipt.useMutation();
  const statementMutation = trpc.ocr.cruiseStatement.useMutation();

  const processSmartOCR = async (imageBase64: string) => {
    if (!selectedType || (selectedType !== 'smart-receipt' && selectedType !== 'smart-statement')) return;
    
    setIsProcessing(true);
    setSmartOcrResult(null);
    
    try {
      let result;
      
      if (selectedType === 'smart-receipt') {
        const requestData: any = { imageBase64 };
        if (!autoDetectMode && selectedCruiseId.trim()) {
          requestData.cruiseId = selectedCruiseId.trim();
        }
        result = await receiptMutation.mutateAsync(requestData);
      } else if (selectedType === 'smart-statement') {
        const requestData: any = {
          files: [{
            base64: imageBase64,
            type: 'image' as const,
            name: 'statement.jpg'
          }]
        };
        if (!autoDetectMode && selectedCruiseId.trim()) {
          requestData.cruiseId = selectedCruiseId.trim();
        }
        result = await statementMutation.mutateAsync(requestData);
      }
      
      setSmartOcrResult(result);
      
      if (result?.success) {
        const message = result.cruiseCreated 
          ? `Success! Created new cruise: ${result.cruiseId}`
          : `Success! Linked to existing cruise: ${result.cruiseId}`;
        Alert.alert('OCR Complete', message);
      }
    } catch (error) {
      console.error('[Smart OCR] Error:', error);
      Alert.alert('Error', `Failed to process: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderPickers = () => {
    if (!selectedType) return null;
    
    const isSmartOCR = selectedType === 'smart-receipt' || selectedType === 'smart-statement';

    return (
      <View style={styles.imagePickerSection}>
        <Text style={styles.sectionTitle}>{isSmartOCR ? 'Upload Document' : 'Add Photos or Files'}</Text>
        
        {isSmartOCR && (
          <View style={styles.smartModeSection}>
            <Text style={styles.smartModeTitle}>Cruise Detection Mode</Text>
            
            <TouchableOpacity 
              style={[styles.modeButton, autoDetectMode && styles.modeButtonActive]} 
              onPress={() => setAutoDetectMode(true)}
            >
              <Zap size={20} color={autoDetectMode ? '#FFFFFF' : '#10B981'} />
              <Text style={[styles.modeButtonText, autoDetectMode && styles.modeButtonTextActive]}>Auto-detect (Recommended)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modeButton, !autoDetectMode && styles.modeButtonActive]} 
              onPress={() => setAutoDetectMode(false)}
            >
              <Target size={20} color={!autoDetectMode ? '#FFFFFF' : '#6C5CE7'} />
              <Text style={[styles.modeButtonText, !autoDetectMode && styles.modeButtonTextActive]}>Specify cruise</Text>
            </TouchableOpacity>
            
            {!autoDetectMode && (
              <TextInput
                style={styles.cruiseIdInput}
                placeholder="Enter cruise ID (optional)"
                value={selectedCruiseId}
                onChangeText={setSelectedCruiseId}
              />
            )}
          </View>
        )}
        
        <View style={styles.imagePickerButtons}>
          <TouchableOpacity 
            style={styles.imagePickerButton} 
            onPress={async () => {
              if (isSmartOCR) {
                const result = await ImagePicker.launchCameraAsync({
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                  base64: true,
                });
                if (!result.canceled && result.assets[0]?.base64) {
                  await processSmartOCR(result.assets[0].base64);
                }
              } else {
                await takePhoto();
              }
            }} 
            testID="take-photo-button"
          >
            <Camera size={32} color="#16a34a" />
            <Text style={styles.imagePickerButtonText}>{isSmartOCR ? 'Take Photo' : (selectedType === 'offer-flyer' ? 'Add Photo' : 'Take Photo')}</Text>
            {selectedType === 'offer-flyer' && imageCount > 0 && (<Text style={styles.imageCountText}>({imageCount} selected)</Text>)}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.imagePickerButton} 
            onPress={async () => {
              if (isSmartOCR) {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                  base64: true,
                });
                if (!result.canceled && result.assets[0]?.base64) {
                  await processSmartOCR(result.assets[0].base64);
                }
              } else {
                await pickImage();
              }
            }} 
            testID="pick-image-button"
          >
            <Upload size={32} color="#16a34a" />
            <Text style={styles.imagePickerButtonText}>{isSmartOCR ? 'Choose from Library' : (selectedType === 'offer-flyer' ? 'Add from Library' : 'Choose from Library')}</Text>
          </TouchableOpacity>
          
          {!isSmartOCR && (
            <TouchableOpacity style={styles.imagePickerButton} onPress={pickFilesXlsx} testID="pick-xlsx-button">
              <Upload size={32} color="#16a34a" />
              <Text style={styles.imagePickerButtonText}>Upload XLSX/PDF</Text>
            </TouchableOpacity>
          )}
        </View>

        {selectedType === 'offer-flyer' && selectedImages.length > 0 && (
          <View style={styles.batchProcessSection}>
            <Text style={styles.batchProcessTitle}>Ready: {selectedImages.length} image(s)</Text>
            <TouchableOpacity style={styles.batchProcessButton} onPress={onLoadPreview} testID="process-batch-button">
              <Text style={styles.batchProcessButtonText}>Load Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearImagesButton} onPress={() => { setSelectedImages([]); setImageCount(0); }} testID="clear-images-button">
              <Text style={styles.clearImagesButtonText}>Clear Selection</Text>
            </TouchableOpacity>
          </View>
        )}

        {pickedFiles.length > 0 && (
          <View style={styles.batchProcessSection}>
            <Text style={styles.batchProcessTitle}>
              {pickedFiles.length} file(s) selected
              {pickedFiles.some(f => f.mime?.includes('pdf') || f.name.toLowerCase().endsWith('.pdf')) && ' (includes PDF)'}
            </Text>
            <TouchableOpacity style={styles.batchProcessButton} onPress={onLoadPreview} testID="load-preview-button">
              <Text style={styles.batchProcessButtonText}>Load Preview</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderSmartResult = () => {
    if (!smartOcrResult) return null;

    return (
      <View style={styles.resultSection}>
        <View style={styles.resultHeader}>
          {smartOcrResult.success ? <CheckCircle size={24} color="#22C55E" /> : <AlertCircle size={24} color="#EF4444" />}
          <Text style={[styles.resultTitle, { color: smartOcrResult.success ? '#22C55E' : '#EF4444' }]}>
            {smartOcrResult.success ? 'Processing Complete' : 'Processing Failed'}
          </Text>
        </View>

        {smartOcrResult.success && (
          <View style={styles.smartResultContent}>
            {smartOcrResult.cruiseCreated && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>✅ New cruise created!</Text>
                <Text style={styles.successSubtext}>Cruise ID: {smartOcrResult.cruiseId}</Text>
              </View>
            )}
            
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>Summary:</Text>
              <Text style={styles.summaryText}>• Processed: {smartOcrResult.processedCount || 1} document(s)</Text>
              <Text style={styles.summaryText}>• Cruise ID: {smartOcrResult.cruiseId}</Text>
              <Text style={styles.summaryText}>• Status: {smartOcrResult.cruiseCreated ? 'New cruise created' : 'Linked to existing cruise'}</Text>
              {smartOcrResult.message && (
                <Text style={styles.summaryText}>• Message: {smartOcrResult.message}</Text>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.viewCruiseButton} 
              onPress={() => {
                router.push(`/cruise/${smartOcrResult.cruiseId}`);
              }}
            >
              <Text style={styles.viewCruiseButtonText}>View Cruise Details</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={() => setSmartOcrResult(null)} 
          testID="dismiss-result-button"
        >
          <Text style={styles.cancelButtonText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderResult = () => {
    if (!result) return null;

    return (
      <View style={styles.resultSection}>
        <View style={styles.resultHeader}>
          {result.success ? <CheckCircle size={24} color="#22C55E" /> : <AlertCircle size={24} color="#EF4444" />}
          <Text style={[styles.resultTitle, { color: result.success ? '#22C55E' : '#EF4444' }]}>
            {result.success ? 'Preview Ready' : 'Processing Failed'}
          </Text>
        </View>

        {result.totalExtracted !== undefined && (
          <Text style={styles.resultStat}>Total rows decoded: {result.totalExtracted}</Text>
        )}

        {Array.isArray(result.previewRows) && result.previewRows.length > 0 && (
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>Preview (first 3)</Text>
            {result.previewRows.slice(0,3).map((row, idx) => (
              <View key={idx} style={styles.previewCruise}>
                <Text style={styles.previewCruiseText}>{row.ship || row.offerName || row.reservationNumber || 'Row'}</Text>
                <Text style={styles.previewCruiseDate}>{row.departureDate || row.expires || ''}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.confirmationButtons}>
          <TouchableOpacity style={styles.confirmButton} onPress={saveLocally} testID="save-locally-button" disabled={isProcessing}>
            <Text style={styles.confirmButtonText}>{isProcessing ? 'Saving...' : 'Save Locally'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setResult(null)} testID="cancel-preview-button" disabled={isProcessing}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {result.errors && result.errors.length > 0 && (
          <View style={styles.errorsSection}>
            <Text style={styles.errorsTitle}>Errors</Text>
            {result.errors.slice(0, 5).map((e, i) => (<Text key={i} style={styles.errorText}>• {e}</Text>))}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} testID="ocr-screen">
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} testID="back-button">
          <ArrowLeft size={24} color="#6C5CE7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart OCR & Document Processing</Text>
      </View>

      <Text style={styles.description}>Smart OCR automatically creates cruises from receipts/statements. Traditional OCR saves locally for later sync.</Text>

      {renderTypeSelector()}
      {renderInputFields()}
      {renderPickers()}

      {isProcessing && (
        <View style={styles.processingSection}>
          <ActivityIndicator size="large" color="#6C5CE7" />
          <Text style={styles.processingText}>
            {(processPdfMutation.isPending || receiptMutation.isPending || statementMutation.isPending) ? 'Processing document (this may take a moment)...' : 'Processing...'}
          </Text>
        </View>
      )}

      {renderSmartResult()}
      {renderResult()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 8, marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#111827' },
  description: { fontSize: 14, color: '#6B7280', padding: 16, textAlign: 'center', lineHeight: 20 },
  typeSelector: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 },
  typeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 2, borderColor: '#E5E7EB' },
  typeButtonActive: { backgroundColor: '#6C5CE7', borderColor: '#6C5CE7' },
  typeButtonContent: { marginLeft: 12, flex: 1 },
  typeButtonTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  typeButtonTitleActive: { color: '#FFFFFF' },
  typeButtonDescription: { fontSize: 14, color: '#6B7280', lineHeight: 18 },
  typeButtonDescriptionActive: { color: '#FFFFFF', opacity: 0.9 },
  inputSection: { padding: 16, paddingTop: 0 },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  textInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  cruiseSelector: { maxHeight: 120 },
  cruiseOption: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8, marginRight: 12, borderWidth: 1, borderColor: '#E5E7EB', minWidth: 120 },
  cruiseOptionActive: { backgroundColor: '#6C5CE7', borderColor: '#6C5CE7' },
  cruiseOptionText: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  cruiseOptionTextActive: { color: '#FFFFFF' },
  cruiseOptionDate: { fontSize: 12, color: '#6B7280' },
  cruiseOptionDateActive: { color: '#FFFFFF', opacity: 0.9 },
  imagePickerSection: { padding: 16, paddingTop: 0 },
  imagePickerButtons: { flexDirection: 'row', gap: 16 },
  imagePickerButton: { flex: 1, backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: '#16a34a', borderStyle: 'dashed' },
  imagePickerButtonText: { fontSize: 14, fontWeight: '600', color: '#16a34a', marginTop: 8, textAlign: 'center' },
  imageCountText: { fontSize: 12, color: '#16a34a', marginTop: 4, textAlign: 'center', opacity: 0.8 },
  batchProcessSection: { backgroundColor: '#F0FDF4', padding: 16, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  batchProcessTitle: { fontSize: 14, color: '#166534', textAlign: 'center', marginBottom: 12, fontWeight: '500' },
  batchProcessButton: { backgroundColor: '#166534', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  batchProcessButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  clearImagesButton: { backgroundColor: '#6B7280', padding: 8, borderRadius: 6, alignItems: 'center' },
  clearImagesButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '500' },
  processingSection: { alignItems: 'center', padding: 32 },
  processingText: { fontSize: 16, color: '#6B7280', marginTop: 16, textAlign: 'center' },
  resultSection: { margin: 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  resultTitle: { fontSize: 18, fontWeight: '600', marginLeft: 8 },
  resultStat: { fontSize: 14, color: '#374151', marginBottom: 8 },
  errorsSection: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FECACA', marginTop: 12 },
  errorsTitle: { fontSize: 14, fontWeight: '600', color: '#DC2626', marginBottom: 8 },
  errorText: { fontSize: 12, color: '#DC2626', marginBottom: 4 },
  previewSection: { backgroundColor: '#EFF6FF', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 12 },
  previewTitle: { fontSize: 14, fontWeight: '600', color: '#1D4ED8', marginBottom: 8 },
  previewCruise: { marginBottom: 6 },
  previewCruiseText: { fontSize: 12, color: '#1D4ED8', fontWeight: '500' },
  previewCruiseDate: { fontSize: 11, color: '#1D4ED8', opacity: 0.8 },
  confirmationButtons: { flexDirection: 'row', gap: 12 },
  confirmButton: { flex: 1, backgroundColor: '#22C55E', padding: 12, borderRadius: 8, alignItems: 'center' },
  confirmButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  cancelButton: { flex: 1, backgroundColor: '#6B7280', padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  
  // Smart OCR styles
  smartOcrSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  smartOcrTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 4,
  },
  smartOcrDescription: {
    fontSize: 14,
    color: '#047857',
    marginBottom: 12,
  },
  smartTypeButton: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  traditionalOcrSection: {
    marginTop: 16,
  },
  traditionalOcrTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  smartModeSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  smartModeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  modeButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  modeButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  cruiseIdInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
  },
  smartResultContent: {
    marginBottom: 16,
  },
  successBanner: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  successText: {
    color: '#065F46',
    fontSize: 16,
    fontWeight: '600',
  },
  successSubtext: {
    color: '#047857',
    fontSize: 14,
    marginTop: 4,
  },
  summaryContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
  },
  summaryText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  viewCruiseButton: {
    backgroundColor: '#3B82F6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  viewCruiseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});