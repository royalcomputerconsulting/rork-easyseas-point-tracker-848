import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { TrendingUp, Gift, Star, Download, Upload } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCelebrity } from '@/state/CelebrityProvider';
import { CruiseCard } from '@/components/CruiseCard';
import { OfferCard } from '@/components/OfferCard';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import { ProgressBar } from '@/components/ui/ProgressBar';

export default function BlueChipClubScreen() {
  const insets = useSafeAreaInsets();
  const celebrityContext = useCelebrity() as any;
  const { blueChipPoints, captainsClubPoints, blueChipLevel, captainsClubLevel, cruises, bookedCruises, offers, setCruises, setOffers } = celebrityContext;

  React.useEffect(() => {
    console.log('[BlueChip] Context updated - Cruises:', cruises?.length || 0, 'Offers:', offers?.length || 0);
  }, [cruises, offers]);

  const totalCruises = useMemo(() => {
    const a = Array.isArray(cruises) ? cruises.length : 0;
    const b = Array.isArray(bookedCruises) ? bookedCruises.length : 0;
    return a + b;
  }, [cruises, bookedCruises]);

  const [activeTab, setActiveTab] = React.useState<'booked' | 'available' | 'offers'>('booked');
  const [busy, setBusy] = React.useState<boolean>(false);
  const [previewData, setPreviewData] = React.useState<any>(null);
  const [selectedFiles, setSelectedFiles] = React.useState<{
    cruises?: DocumentPicker.DocumentPickerAsset;
    offers?: DocumentPicker.DocumentPickerAsset;
  }>({});
  const [localImporting, setLocalImporting] = React.useState<boolean>(false);

  const pickXlsx = async (): Promise<DocumentPicker.DocumentPickerAsset | null> => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.[0]) return null;
    return res.assets[0];
  };

  const parseSheet = async (asset: DocumentPicker.DocumentPickerAsset): Promise<any[]> => {
    const resp = await fetch(asset.uri);
    const buf = await resp.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
    if (grid.length <= 1) return [];
    const headers = (grid[0] as string[]).map((h) => String(h).trim());
    const rows = grid.slice(1).filter((r) => r.some((c) => c !== '' && c !== null && c !== undefined));
    return rows.map((row) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = row[i];
      });
      return obj;
    });
  };

  const toIso = (v: any): string | '' => {
    if (!v && v !== 0) return '';
    if (typeof v === 'number') {
      const excelEpoch = new Date(1900, 0, 1);
      const d = new Date(excelEpoch.getTime() + (v - 2) * 86400000);
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    }
    const d = new Date(String(v));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    const m = String(v).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const mm = parseInt(m[1], 10); const dd = parseInt(m[2], 10); const yy = parseInt(m[3].length === 2 ? `20${m[3]}` : m[3], 10);
      const dt = new Date(yy, mm - 1, dd);
      return isNaN(dt.getTime()) ? '' : dt.toISOString().split('T')[0];
    }
    return '';
  };

  const selectCelebrityCruisesFile = async () => {
    try {
      const asset = await pickXlsx();
      if (!asset) return;
      setSelectedFiles(prev => ({ ...prev, cruises: asset }));
      Alert.alert('File Selected ✅', `Selected: ${asset.name}\nSize: ${((asset.size || 0) / 1024).toFixed(1)} KB`);
    } catch (e: any) {
      Alert.alert('File Picker Error', e?.message ?? 'Failed to select file');
    }
  };

  const selectCelebrityOffersFile = async () => {
    try {
      const asset = await pickXlsx();
      if (!asset) return;
      setSelectedFiles(prev => ({ ...prev, offers: asset }));
      Alert.alert('File Selected ✅', `Selected: ${asset.name}\nSize: ${((asset.size || 0) / 1024).toFixed(1)} KB`);
    } catch (e: any) {
      Alert.alert('File Picker Error', e?.message ?? 'Failed to select file');
    }
  };

  const loadPreview = async () => {
    const hasFiles = Object.keys(selectedFiles).length > 0;
    if (!hasFiles) {
      Alert.alert('Error', 'Please select at least one file first');
      return;
    }

    setBusy(true);
    console.log('[BlueChip] Loading preview from files');

    try {
      const parsed: any = {};

      if (selectedFiles.cruises) {
        const rows = await parseSheet(selectedFiles.cruises);
        const mapped = rows.map((row, index) => {
          const dep = toIso(row['Sailing Date'] ?? row['SAILING DATE'] ?? row['Departure Date'] ?? row['Start Date'] ?? row['departureDate']);
          const nights = parseInt(String(row['Nights'] ?? row['NIGHTS'] ?? row['Length'] ?? row['nights'] ?? '7')) || 7;
          let ret = toIso(row['Return Date'] ?? row['End Date'] ?? row['returnDate']);
          if (!ret && dep && nights > 0) {
            const d = new Date(dep); d.setDate(d.getDate() + nights); ret = d.toISOString().split('T')[0];
          }
          return {
            id: row.id ?? `celeb-cruise-${Date.now()}-${index}`,
            ship: String(row['Ship'] ?? row['Ship Name'] ?? row['SHIP NAME'] ?? row['ship'] ?? 'Unknown').replace(/\s*(\u00AE|\u2122|\[R\])\s*/g, '').trim(),
            itineraryName: String(row['Itinerary'] ?? row['ITINERARY'] ?? row['Itinerary Name'] ?? row['itineraryName'] ?? ''),
            departurePort: String(row['Departure Port'] ?? row['DEPARTURE PORT'] ?? row['Port'] ?? row['departurePort'] ?? ''),
            departureDate: dep,
            returnDate: ret,
            nights,
            line: 'Celebrity',
            region: String(row['Region'] ?? row['REGION'] ?? row['region'] ?? 'Caribbean'),
            status: 'on_sale' as const,
            cabinType: String(row['Cabin Type'] ?? row['CABIN TYPE'] ?? row['cabinType'] ?? 'Interior'),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }).filter((c) => c.ship && c.departureDate);
        parsed.cruises = mapped;
        console.log(`[BlueChip] Parsed ${mapped.length} Celebrity cruises`);
      }

      if (selectedFiles.offers) {
        const rows = await parseSheet(selectedFiles.offers);
        const mapped = rows.map((row, index) => {
          const expires = toIso(row['Expires'] ?? row['EXPIRES'] ?? row['Expiration Date'] ?? row['expires']);
          const shipsRaw = row['Ships'] ?? row['SHIPS'] ?? row['Ship'] ?? row['ship'] ?? '';
          const ships = shipsRaw ? String(shipsRaw).split(',').map((s: string) => s.trim()).filter(Boolean) : undefined;
          return {
            id: row.id ?? `celeb-offer-${Date.now()}-${index}`,
            name: String(row['Name'] ?? row['NAME'] ?? row['name'] ?? ''),
            offerName: String(row['Offer Name'] ?? row['OFFER NAME'] ?? row['offerName'] ?? ''),
            offerType: String(row['Offer Type'] ?? row['OFFER TYPE'] ?? row['offerType'] ?? ''),
            offerCode: String(row['Offer Code'] ?? row['OFFER CODE'] ?? row['offerCode'] ?? ''),
            tradeInValue: String(row['Trade In Value'] ?? row['TRADE IN VALUE'] ?? row['tradeInValue'] ?? ''),
            expires,
            ships,
            cruiseLine: 'Celebrity',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }).filter((o) => o.offerCode);
        parsed.offers = mapped;
        console.log(`[BlueChip] Parsed ${mapped.length} Celebrity offers`);
      }

      console.log('[BlueChip] Final parsed data:', {
        cruises: parsed.cruises?.length || 0,
        offers: parsed.offers?.length || 0
      });

      if (!parsed.cruises && !parsed.offers) {
        Alert.alert('No Data Found', 'Could not find any data in the selected files.');
        return;
      }

      setPreviewData(parsed);
    } catch (error: any) {
      console.error('[BlueChip] File processing error:', error);
      Alert.alert('Error', `Failed to process files: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleLocalOnlyImport = async () => {
    if (!previewData) {
      Alert.alert('Error', 'Please load preview first');
      return;
    }

    setLocalImporting(true);
    console.log('[BlueChip] Starting local save process...');
    console.log('[BlueChip] Preview data:', {
      cruisesCount: previewData.cruises?.length || 0,
      offersCount: previewData.offers?.length || 0,
      firstCruise: previewData.cruises?.[0]
    });

    try {
      if (previewData.cruises && previewData.cruises.length > 0) {
        console.log('[BlueChip] Calling setCruises with data...');
        await setCruises(previewData.cruises);
        console.log(`[BlueChip] ✅ Saved ${previewData.cruises.length} Celebrity cruises`);
        
        // Verify the data was saved
        setTimeout(() => {
          console.log('[BlueChip] Current cruises in state:', cruises?.length || 0);
        }, 100);
      }

      if (previewData.offers && previewData.offers.length > 0) {
        console.log('[BlueChip] Calling setOffers with data...');
        await setOffers(previewData.offers);
        console.log(`[BlueChip] ✅ Saved ${previewData.offers.length} Celebrity offers`);
        
        // Verify the data was saved
        setTimeout(() => {
          console.log('[BlueChip] Current offers in state:', offers?.length || 0);
        }, 100);
      }

      const importSummary = [
        previewData.cruises?.length > 0 ? `• ${previewData.cruises.length} Celebrity cruises` : null,
        previewData.offers?.length > 0 ? `• ${previewData.offers.length} Celebrity offers` : null
      ].filter(Boolean).join('\n');

      console.log('[BlueChip] ✅ Import complete! Showing success alert...');
      Alert.alert(
        'Import Complete! ✅',
        `Successfully imported:\n\n${importSummary}\n\nData is now available in the Blue Chip Club!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setPreviewData(null);
              setSelectedFiles({});
            }
          }
        ]
      );
    } catch (e: any) {
      console.error('[BlueChip] Local import failed:', e);
      Alert.alert('Import Failed ❌', `Error: ${e?.message ?? 'Could not save locally'}`);
    } finally {
      setLocalImporting(false);
    }
  };

  const resetImportState = () => {
    console.log('[BlueChip] Resetting import state');
    setPreviewData(null);
    setSelectedFiles({});
    setBusy(false);
    setLocalImporting(false);
  };

  const exportXlsx = async (rows: any[], name: string) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const fileName = `${name}.xlsx`;
    if (Platform.OS === 'web') {
      const blob = new Blob([Uint8Array.from(atob(wbout), (c) => c.charCodeAt(0))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url);
      Alert.alert('Export Complete', `${fileName} downloaded`);
    } else {
      const FileSystem = require('expo-file-system');
      const Sharing = require('expo-sharing');
      const uri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(uri, wbout, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      else Alert.alert('Export Complete', `Saved to ${uri}`);
    }
  };

  const exportCelebrityCruises = async () => {
    try {
      setBusy(true);
      const rows = (Array.isArray(cruises) ? cruises : []).map((c: any) => ({
        id: c.id ?? '',
        Ship: c.ship ?? '',
        Itinerary: c.itineraryName ?? '',
        'Departure Port': c.departurePort ?? '',
        'Sailing Date': c.departureDate ?? '',
        'Return Date': c.returnDate ?? '',
        Nights: c.nights ?? '',
        Line: 'Celebrity',
      }));
      await exportXlsx(rows, 'celebrity_cruises');
    } finally {
      setBusy(false);
    }
  };

  const exportCelebrityOffers = async () => {
    try {
      setBusy(true);
      const rows = (Array.isArray(offers) ? offers : []).map((o: any) => ({
        id: o.id ?? '',
        Name: o.name ?? o.offerName ?? '',
        'Offer Name': o.offerName ?? '',
        'Offer Type': o.offerType ?? '',
        'Offer Code': o.offerCode ?? '',
        Expires: o.expires ?? '',
        Ships: Array.isArray(o.ships) ? o.ships.join(', ') : '',
        'Trade In Value': o.tradeInValue ?? '',
      }));
      await exportXlsx(rows, 'celebrity_offers');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Blue Chip Club',
          headerStyle: { backgroundColor: '#001F3F' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />

      <View style={{ height: insets.top, backgroundColor: '#001F3F' }} />

      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <View style={styles.heroWrap} testID="celebrity-hero">
            <LinearGradient
              colors={["#001F3F", "#0B3A6E", "#0E5AA6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <View style={styles.heroLogosRow}>
                <View style={styles.logoCard}>
                  <View style={styles.logoImageWrap}>
                    <Text accessibilityRole="header" style={styles.logoAltText}>Blue Chip Club</Text>
                  </View>
                </View>
                <View style={styles.logoDivider} />
                <View style={styles.logoCard}>
                  <View style={styles.logoImageWrap}>
                    <Text style={styles.logoAltText}>Easy Seas</Text>
                  </View>
                </View>
              </View>
              <View style={styles.heroStatsRow}>
                <View style={styles.statPill}>
                  <Text style={styles.statPillLabel}>Blue Chip</Text>
                  <Text style={styles.statPillValue}>{blueChipLevel ?? '—'}</Text>
                  <Text style={styles.statPillSub}>{(blueChipPoints ?? 0).toLocaleString()} pts</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statPillLabel}>Captain&#39;s Club</Text>
                  <Text style={styles.statPillValue}>{captainsClubLevel ?? '—'}</Text>
                  <Text style={styles.statPillSub}>{(captainsClubPoints ?? 0).toLocaleString()} pts</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statPillLabel}>Celebrity</Text>
                  <Text style={styles.statPillValue}>{totalCruises.toLocaleString()}</Text>
                  <Text style={styles.statPillSub}>cruises</Text>
                </View>
              </View>
              <View style={styles.heroBrandRow}>
                <Text style={styles.brandLeft}>Celebrity Cruises</Text>
                <Text style={styles.brandRight}>Blue Chip Club</Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.content}>
            <View style={styles.tabsRow}>
              {(['booked','available','offers'] as const).map(tab => (
                <TouchableOpacity key={tab} style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]} onPress={() => setActiveTab(tab)} testID={`bccc-tab-${tab}`}>
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {activeTab === 'booked' && (
              <View style={styles.listWrap}>
                {Array.isArray(bookedCruises) && bookedCruises.length > 0 ? (
                  bookedCruises.map((c) => (
                    <CruiseCard
                      key={`bc-${c.id}`}
                      cruise={c as any}
                      onPress={() => {
                        const cruiseId = String((c as any).id || `${(c as any).ship}-${(c as any).departureDate}`);
                        router.push(`/cruise/${encodeURIComponent(cruiseId)}`);
                      }}
                    />
                  ))
                ) : (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyTitle}>No booked Celebrity cruises</Text>
                    <Text style={styles.emptyText}>Import your Celebrity bookings to see them here.</Text>
                  </View>
                )}
              </View>
            )}

            {activeTab === 'available' && (
              <View style={styles.listWrap}>
                {Array.isArray(cruises) && cruises.length > 0 ? (
                  cruises.map((c) => (
                    <CruiseCard
                      key={`ac-${c.id}`}
                      cruise={c as any}
                      onPress={() => {
                        const cruiseId = String((c as any).id || `${(c as any).ship}-${(c as any).departureDate}`);
                        router.push(`/cruise/${encodeURIComponent(cruiseId)}`);
                      }}
                    />
                  ))
                ) : (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyTitle}>No available Celebrity cruises</Text>
                    <Text style={styles.emptyText}>Import Celebrity cruise data to explore options.</Text>
                  </View>
                )}
              </View>
            )}

            {activeTab === 'offers' && (
              <View style={styles.listWrap}>
                {Array.isArray(offers) && offers.length > 0 ? (
                  offers.map((o: any) => (
                    <OfferCard
                      key={`off-${o.id}`}
                      id={String(o.id)}
                      offerName={o.offerName || o.name || 'Offer'}
                      offerCode={o.offerCode || ''}
                      expires={o.expires}
                      cruisesCount={0}
                      associatedCruises={[]}
                      perks={o.perks}
                      tradeInValue={o.tradeInValue}
                      onPress={() => router.push(`/offer/celebrity/${encodeURIComponent(String(o.id))}`)}
                      testID={`celebrity-offer-${String(o.id)}`}
                    />
                  ))
                ) : (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyTitle}>No Celebrity offers</Text>
                    <Text style={styles.emptyText}>Import Blue Chip Club offers to see them here.</Text>
                  </View>
                )}
              </View>
            )}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <TrendingUp size={24} color="#001F3F" />
                <Text style={styles.sectionTitle}>Your Status</Text>
              </View>

              {/* Blue Chip points progress */}
              <View style={styles.statusCard} testID="bc-progress-card">
                <Text style={styles.statusLabel}>Blue Chip Points</Text>
                {(() => {
                  const bcPoints: number = Number.isFinite(blueChipPoints) ? Number(blueChipPoints) : 0;
                  const NEXT_TIER_TARGET = 10000;
                  const remaining = Math.max(0, NEXT_TIER_TARGET - bcPoints);
                  const percentage = Math.max(0, Math.min(100, (bcPoints / NEXT_TIER_TARGET) * 100));
                  console.log('[BlueChip][BC] points:', bcPoints, 'remaining:', remaining, 'pct:', percentage.toFixed(2));
                  return (
                    <>
                      <Text style={styles.statusSubValue}>{bcPoints.toLocaleString()} of {NEXT_TIER_TARGET.toLocaleString()} pts</Text>
                      <View style={styles.pbWrap}>
                        <ProgressBar value={bcPoints} max={NEXT_TIER_TARGET} height={12} />
                      </View>
                      <Text style={styles.progressText}>Progress to next tier</Text>
                    </>
                  );
                })()}
              </View>

              {/* Captain's Club progress to Zenith (shown below Blue Chip) */}
              <View style={styles.statusCard} testID="cc-progress-card">
                <Text style={styles.statusLabel}>Zenith Progress</Text>
                {(() => {
                  const ccPoints: number = Number.isFinite(captainsClubPoints) ? Number(captainsClubPoints) : 0;
                  const ZENITH_TARGET = 3000;
                  const remaining = Math.max(0, ZENITH_TARGET - ccPoints);
                  const percentage = Math.max(0, Math.min(100, (ccPoints / ZENITH_TARGET) * 100));
                  console.log('[BlueChip][CC] points:', ccPoints, 'remaining:', remaining, 'pct:', percentage.toFixed(2));
                  return (
                    <>
                      <Text style={styles.statusSubValue}>{ccPoints.toLocaleString()} of {ZENITH_TARGET.toLocaleString()} pts</Text>
                      <View style={styles.pbWrap}>
                        <ProgressBar value={ccPoints} max={ZENITH_TARGET} height={12} />
                      </View>
                      <Text style={styles.progressText}>{remaining.toLocaleString()} points to Zenith</Text>
                    </>
                  );
                })()}
              </View>
            </View>



            <View style={styles.importSection}>
              <Text style={styles.importSectionTitle}>Import Celebrity Data</Text>
              <Text style={styles.importHelperText}>Select files to import, preview the data, then save locally</Text>
              
              <View style={styles.fileSelectRow}>
                <TouchableOpacity
                  style={[styles.fileSelectButton, selectedFiles.cruises && styles.fileSelectButtonSelected]}
                  onPress={selectCelebrityCruisesFile}
                  disabled={busy || localImporting}
                  testID="select-celeb-cruises"
                >
                  {selectedFiles.cruises ? (
                    <Text style={styles.fileSelectTextSelected}>✓ Celebrity Cruises</Text>
                  ) : (
                    <>
                      <Upload size={16} color="#0EA5E9" />
                      <Text style={styles.fileSelectText}>Select Cruises</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.fileSelectButton, selectedFiles.offers && styles.fileSelectButtonSelected]}
                  onPress={selectCelebrityOffersFile}
                  disabled={busy || localImporting}
                  testID="select-celeb-offers"
                >
                  {selectedFiles.offers ? (
                    <Text style={styles.fileSelectTextSelected}>✓ Celebrity Offers</Text>
                  ) : (
                    <>
                      <Upload size={16} color="#0EA5E9" />
                      <Text style={styles.fileSelectText}>Select Offers</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.loadPreviewButton, (busy || !Object.keys(selectedFiles).length) && styles.buttonDisabled]}
                onPress={loadPreview}
                disabled={busy || !Object.keys(selectedFiles).length}
                testID="load-preview-button"
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Upload size={18} color="#FFFFFF" />
                    <Text style={styles.ieButtonText}>Load Preview</Text>
                  </>
                )}
              </TouchableOpacity>

              {previewData && (
                <View style={styles.previewSection}>
                  <Text style={styles.previewTitle}>Data Preview</Text>
                  
                  {previewData.cruises && (
                    <View style={styles.previewCard}>
                      <Text style={styles.previewCardTitle}>Celebrity Cruises</Text>
                      <Text style={styles.previewCardText}>{previewData.cruises.length} rows detected</Text>
                    </View>
                  )}

                  {previewData.offers && (
                    <View style={styles.previewCard}>
                      <Text style={styles.previewCardTitle}>Celebrity Offers</Text>
                      <Text style={styles.previewCardText}>{previewData.offers.length} rows detected</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.saveLocallyButton, localImporting && styles.buttonDisabled]}
                    onPress={handleLocalOnlyImport}
                    disabled={localImporting}
                    testID="save-locally-button"
                  >
                    {localImporting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Download size={18} color="#FFFFFF" />
                        <Text style={styles.ieButtonText}>Save Locally</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.resetButton, localImporting && styles.buttonDisabled]}
                    onPress={resetImportState}
                    disabled={localImporting}
                    testID="reset-import-button"
                  >
                    <Text style={styles.resetButtonText}>Reset / Start Over</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Export Celebrity Data</Text>
            </View>

            <View style={styles.importExportRow}>
              <TouchableOpacity style={[styles.ieButton, styles.exportBtn]} onPress={exportCelebrityCruises} disabled={busy} testID="export-celeb-cruises">
                {busy ? <ActivityIndicator color="#FFFFFF" /> : (<>
                  <Download size={18} color="#FFFFFF" />
                  <Text style={styles.ieButtonText}>Export Celebrity Cruises</Text>
                </>)}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ieButton, styles.exportBtn]} onPress={exportCelebrityOffers} disabled={busy} testID="export-celeb-offers">
                {busy ? <ActivityIndicator color="#FFFFFF" /> : (<>
                  <Download size={18} color="#FFFFFF" />
                  <Text style={styles.ieButtonText}>Export Celebrity Offers</Text>
                </>)}
              </TouchableOpacity>
            </View>


          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20 },
  heroWrap: { marginHorizontal: 20, marginTop: 12, marginBottom: 16, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  heroGradient: { padding: 16 },
  heroLogosRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoCard: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  logoImageWrap: { width: '100%', height: 56, alignItems: 'center', justifyContent: 'center' },
  logoAltText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  logoDivider: { width: 1, height: 44, backgroundColor: 'rgba(255,255,255,0.25)' },
  heroStatsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  statPillLabel: { color: '#CFE3FF', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  statPillValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  statPillSub: { color: '#E5E7EB', fontSize: 12, fontWeight: '600', opacity: 0.9 },
  heroBrandRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  brandLeft: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', opacity: 0.85 },
  brandRight: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', opacity: 0.85 },
  tabsRow: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 4, marginBottom: 16 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabButtonActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  tabTextActive: { color: '#111827' },
  listWrap: { gap: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptyText: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  statusCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  statusLabel: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  statusValue: { fontSize: 24, fontWeight: '700', color: '#001F3F', marginBottom: 8 },
  statusSubValue: { fontSize: 14, fontWeight: '700', color: '#0B3A6E', marginBottom: 8 },
  pbWrap: { marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, marginBottom: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#001F3F', borderRadius: 4 },
  progressText: { fontSize: 12, color: '#6B7280' },
  benefitsList: { gap: 16 },
  benefitItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  benefitContent: { flex: 1 },
  benefitTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  benefitDescription: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  actionButton: { backgroundColor: '#001F3F', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  importExportRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  ieButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  importBtn: { backgroundColor: '#0EA5E9' },
  exportBtn: { backgroundColor: '#4F46E5' },
  ieButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  importSection: { marginBottom: 24, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  importSectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  importHelperText: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  fileSelectRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  fileSelectButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#0EA5E9', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, borderStyle: 'dashed' as const },
  fileSelectButtonSelected: { borderColor: '#22C55E', backgroundColor: '#F0FDF4', borderStyle: 'solid' as const },
  fileSelectText: { fontSize: 13, color: '#0EA5E9', fontWeight: '600' },
  fileSelectTextSelected: { fontSize: 13, color: '#22C55E', fontWeight: '600' },
  loadPreviewButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0EA5E9', paddingVertical: 14, borderRadius: 12, marginBottom: 16 },
  buttonDisabled: { opacity: 0.5 },
  previewSection: { marginTop: 16, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 },
  previewTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  previewCard: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  previewCardTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  previewCardText: { fontSize: 12, color: '#6B7280' },
  saveLocallyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12, marginTop: 12 },
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6B7280', paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  resetButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 20 },
});
