import React, { useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FolderSearch, RefreshCw, Save, FileSpreadsheet, Calendar as CalIcon, Gift, Ship, CloudDownload } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useCruiseStore } from '@/state/CruiseStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as XLSX from 'xlsx';

interface PreviewBlockProps {
  title: string;
  count: number;
  icon: 'cruises' | 'booked' | 'offers' | 'calendar' | 'tripit';
  rows: Record<string, unknown>[];
}

function PreviewBlock({ title, count, icon, rows }: PreviewBlockProps) {
  const iconEl = useMemo(() => {
    const size = 16;
    const color = '#111827';
    switch (icon) {
      case 'cruises':
        return <Ship size={size} color={color} />;
      case 'booked':
        return <FileSpreadsheet size={size} color={color} />;
      case 'offers':
        return <Gift size={size} color={color} />;
      case 'calendar':
      case 'tripit':
        return <CalIcon size={size} color={color} />;
      default:
        return <FolderSearch size={size} color={color} />;
    }
  }, [icon]);

  const previewRows = useMemo(() => rows.slice(0, 10), [rows]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text>{iconEl}</Text>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardCount}>{count} rows</Text>
      </View>
      {previewRows.length === 0 ? (
        <Text style={styles.emptyText}>No rows found</Text>
      ) : (
        <FlatList
          data={previewRows}
          keyExtractor={(_, i) => `${title}-${i}`}
          renderItem={({ item }) => (
            <View style={styles.rowItem}>
              <Text style={styles.rowText} numberOfLines={2}>
                {JSON.stringify(item)}
              </Text>
            </View>
          )}
          scrollEnabled={false}
        />
      )}
    </View>
  );
}

type ScanData = {
  cruises: Record<string, unknown>[];
  booked: Record<string, unknown>[];
  offers: Record<string, unknown>[];
  calendar: Record<string, unknown>[];
  tripit: Record<string, unknown>[];
};

type Counts = { cruises: number; booked: number; offers: number; events: number; tripit?: number };

function buildAlternateUrls(url: string): string[] {
  const urls: string[] = [url];
  try {
    const u = new URL(url);
    if (u.hostname === 'raw.githubusercontent.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 4) {
        const owner = parts[0];
        const repo = parts[1];
        const branch = parts[2];
        const path = parts.slice(3).join('/');
        urls.push(`https://github.com/${owner}/${repo}/raw/${branch}/${path}`);
        urls.push(`https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`);
      }
    } else if (u.hostname === 'github.com' && u.pathname.includes('/blob/')) {
      urls.push(url.replace('/blob/', '/raw/'));
    }
  } catch {}
  return Array.from(new Set(urls));
}

async function fetchWithFallback(url: string): Promise<Response> {
  const cacheBust = `?_=${Date.now()}`;
  const candidates = [
    ...buildAlternateUrls(url).map((u) => (u.includes('?') ? `${u}&${cacheBust.slice(2)}` : `${u}${cacheBust}`)),
  ];
  let lastError: any = null;
  for (const u of candidates) {
    try {
      const res = await fetch(u, { cache: 'no-store' });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`Failed to fetch after ${candidates.length} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetchWithFallback(url);
  return await res.text();
}

async function fetchXlsxRows(url: string): Promise<Record<string, unknown>[]> {
  const res = await fetchWithFallback(url);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  let bestRows: Record<string, unknown>[] = [];
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) as Record<string, unknown>[];
    if (rows.length > bestRows.length) bestRows = rows;
  });
  if (bestRows.length === 0 && wb.SheetNames.length) {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) as Record<string, unknown>[];
    bestRows = rows;
  }
  return bestRows;
}

function parseICS(ics: string): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];
  if (!ics) return events;
  const lines = ics.split('\n').map((l) => l.trim());
  let current: any = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === 'BEGIN:VEVENT') {
      current = { summary: '', startDate: '', endDate: '', location: '', description: '', source: 'manual' };
    } else if (line === 'END:VEVENT' && current) {
      if (current.summary && current.startDate) events.push(current);
      current = null;
    } else if (current && line.includes(':')) {
      const [keyRaw, ...vp] = line.split(':');
      const value = vp.join(':');
      const key = keyRaw.split(';')[0];
      switch (key) {
        case 'SUMMARY':
          current.summary = value;
          break;
        case 'DTSTART':
        case 'DTSTART;VALUE=DATE': {
          const v = value;
          if (/^\d{8}$/.test(v)) current.startDate = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
          else if (v.includes('T')) {
            const d = v.split('T')[0];
            current.startDate = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
          }
          break;
        }
        case 'DTEND':
        case 'DTEND;VALUE=DATE': {
          const v = value;
          if (/^\d{8}$/.test(v)) current.endDate = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
          else if (v.includes('T')) {
            const d = v.split('T')[0];
            current.endDate = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
          }
          break;
        }
        case 'LOCATION':
          current.location = value;
          break;
        case 'DESCRIPTION':
          current.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
          break;
      }
    }
  }
  return events;
}

export default function ProcessDataFolderScreen() {
  const insets = useSafeAreaInsets();
  const [didScan, setDidScan] = useState<boolean>(false);
  const [githubCounts, setGithubCounts] = useState<{ cruises: number; booked: number; offers: number; events: number } | null>(null);
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [scanCounts, setScanCounts] = useState<Counts | null>(null);

  const readQuery = trpc.import.readDataFolder.useQuery(undefined, {
    enabled: false,
    retry: 0,
  });

  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const importMutation = trpc.import.importLocalFile.useMutation();
  const loadGithubMutation = trpc.import.loadFromGithub.useMutation();

  const onScan = async () => {
    try {
      console.log('[ProcessDataFolder] Starting scan using backend tRPC...');
      
      // Use the backend tRPC import.readDataFolder to read files directly from the server
      const result = await readQuery.refetch();
      
      if (!result.data) {
        throw new Error('No data returned from backend');
      }
      
      const data = result.data.data as ScanData;
      const rawCounts = result.data.counts as any;
      const counts: Counts = {
        cruises: rawCounts.cruises || 0,
        booked: rawCounts.booked || 0,
        offers: rawCounts.offers || 0,
        events: (rawCounts.calendar || 0) + (rawCounts.tripit || 0),
        tripit: rawCounts.tripit || 0
      };
      
      console.log('[ProcessDataFolder] Scan complete:', {
        cruises: data.cruises?.length || 0,
        booked: data.booked?.length || 0,
        offers: data.offers?.length || 0,
        calendar: data.calendar?.length || 0,
        tripit: data.tripit?.length || 0
      });

      setScanData(data);
      setScanCounts(counts);
      setDidScan(true);
      
      if (counts.cruises === 0 && counts.booked === 0 && counts.offers === 0) {
        Alert.alert('Scan Warning', 'No data found in DATA folder. The files may not exist on the server.');
      } else {
        Alert.alert('Scan complete', `Cruises: ${counts.cruises}\nBooked: ${counts.booked}\nOffers: ${counts.offers}\nEvents: ${counts.events || 0}`);
      }
    } catch (e: any) {
      console.error('[ProcessDataFolder] Scan error:', e);
      Alert.alert('Scan failed', e?.message ?? 'Unknown error');
    }
  };

  const { upsertCruises } = useCruiseStore();
  const onSaveLocally = async () => {
    try {
      const data = scanData ?? (readQuery.data?.data as unknown as ScanData | undefined);
      if (!data) {
        Alert.alert('Nothing to save', 'Please scan first.');
        return;
      }

      console.log('[ProcessDataFolder] Starting import with data:', {
        cruises: Array.isArray(data.cruises) ? data.cruises.length : 0,
        booked: Array.isArray(data.booked) ? data.booked.length : 0,
        offers: Array.isArray(data.offers) ? data.offers.length : 0,
        calendar: Array.isArray((data as any).calendar) ? (data as any).calendar.length : 0,
      });

      const res = await importMutation.mutateAsync({
        data: {
          cruises: Array.isArray(data.cruises) ? (data.cruises as any[]) : [],
          booked: Array.isArray(data.booked) ? (data.booked as any[]) : [],
          offers: Array.isArray(data.offers) ? (data.offers as any[]) : [],
          calendar: [
            ...(Array.isArray((data as any).calendar) ? ((data as any).calendar as any[]) : []),
            ...(Array.isArray((data as any).tripit) ? ((data as any).tripit as any[]) : []),
          ],
        },
        clearExisting: true,
        batchSize: 200,
      });

      console.log('[ProcessDataFolder] Import completed:', res);

      try {
        console.log('[ProcessDataFolder] Fetching normalized cruises from backend to persist locally...');
        const client = (await import('@/lib/trpc')).trpcClient;
        const list = await client.cruises.list.query({ limit: 5000, offset: 0 });
        const normalized = Array.isArray((list as any).cruises) ? (list as any).cruises : [];
        console.log('[ProcessDataFolder] Received', normalized.length, 'cruises from backend');
        if (normalized.length > 0) {
          try {
            const result = await upsertCruises(normalized as any);
            console.log('[ProcessDataFolder] Persisted to CruiseStore (AsyncStorage):', result);
          } catch (persistErr) {
            console.error('[ProcessDataFolder] Failed to persist to CruiseStore', persistErr);
          }
        }
      } catch (syncErr) {
        console.warn('[ProcessDataFolder] Could not sync cruises from backend to local store', syncErr);
      }

      Alert.alert(
        'Saved locally',
        `Cruises: ${res.cruises}\nBooked: ${res.booked}\nOffers: ${res.offers}\nEvents: ${res.events}`
      );
    } catch (e: any) {
      console.error('[ProcessDataFolder] Save failed:', e);
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    }
  };

  const counts = scanCounts ?? readQuery.data?.counts ?? githubCounts ?? undefined;
  const rows = scanData ?? (readQuery.data?.data as unknown as ScanData | undefined);
  const calCount = (counts as any)?.calendar ?? (counts as any)?.events ?? 0;
  const tripitCount = (counts as any)?.tripit ?? 0;

  return (
    <>
      <Stack.Screen options={{ title: 'Process DATA Folder' }} />
      <ScrollView style={[styles.container, { paddingBottom: insets.bottom }]} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>Scan GitHub DATA</Text>
          <Text style={styles.subtitle}>
            Source of truth is the GitHub DATA folder. This scans cruises.xlsx, booked.xlsx, offers.xlsx, tripit.ics, and calendar.ics, shows a preview, then lets you persist into the app.
          </Text>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.primaryBtn, (importMutation.isPending) && styles.btnDisabled]}
              onPress={onScan}
              disabled={importMutation.isPending}
              testID="scan-data-folder-button"
            >
              <RefreshCw size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Scan DATA</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, (!didScan || importMutation.isPending) && styles.btnDisabled]}
              onPress={onSaveLocally}
              disabled={!didScan || importMutation.isPending}
              testID="save-locally-button"
            >
              {importMutation.isPending ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Save size={18} color="#111827" />
              )}
              <Text style={styles.secondaryBtnText}>Persist Locally</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, loadGithubMutation.isPending && styles.btnDisabled]}
              onPress={async () => {
                try {
                  const res = await loadGithubMutation.mutateAsync({ repoUrlBase: 'https://raw.githubusercontent.com/royalcomputerconsulting/projectC-624/main/DATA', clearExisting: true });
                  if ((res as any)?.success && (res as any)?.counts) {
                    const c = (res as any).counts as { cruises: number; booked: number; offers: number; events: number };
                    setGithubCounts(c);
                    setDidScan(true);
                    Alert.alert('Loaded & Persisted', `Cruises: ${c.cruises}\nBooked: ${c.booked}\nOffers: ${c.offers}\nEvents: ${c.events}`);
                  } else {
                    Alert.alert('Load failed', (res as any)?.error ?? 'Unknown error');
                  }
                } catch (e: any) {
                  Alert.alert('Load failed', e?.message ?? 'Unknown error');
                }
              }}
              disabled={loadGithubMutation.isPending}
              testID="load-github-button"
            >
              {loadGithubMutation.isPending ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <CloudDownload size={18} color="#111827" />
              )}
              <Text style={styles.secondaryBtnText}>Load & Persist (GitHub DATA)</Text>
            </TouchableOpacity>
          </View>

          {(readQuery.error || loadGithubMutation.error) && (
            <Text style={styles.errorText} testID="scan-error">
              {String(readQuery.error?.message ?? loadGithubMutation.error?.message)}
            </Text>
          )}

          <View style={styles.row}>
            <TouchableOpacity
              style={styles.tertiaryBtn}
              onPress={async () => {
                try {
                  const localApiBase = typeof window !== 'undefined' && window.location ? 
                    `${window.location.protocol}//${window.location.host}/api/data` : 
                    '/api/data';
                  const githubBase = 'https://raw.githubusercontent.com/royalcomputerconsulting/projectC-624/main/DATA';
                  
                  const files = ['cruises.xlsx', 'booked.xlsx', 'offers.xlsx', 'calendar.ics', 'tripit.ics'];
                  const results: string[] = [];
                  
                  results.push('=== LOCAL API TEST ===');
                  for (const file of files) {
                    try {
                      const res = await fetch(`${localApiBase}/${file}`);
                      results.push(`${file}: ${res.status} ${res.ok ? 'OK' : 'FAIL'} (${res.headers.get('content-type') ?? 'no-ct'})`);
                    } catch (err: any) {
                      results.push(`${file}: ERROR ${err?.message ?? String(err)}`);
                    }
                  }
                  
                  results.push('\n=== GITHUB TEST ===');
                  for (const file of files) {
                    try {
                      const res = await fetchWithFallback(`${githubBase}/${file}`);
                      results.push(`${file}: ${res.status} ${res.ok ? 'OK' : 'FAIL'} (${res.headers.get('content-type') ?? 'no-ct'})`);
                    } catch (err: any) {
                      results.push(`${file}: ERROR ${err?.message ?? String(err)}`);
                    }
                  }
                  
                  const text = results.join('\n');
                  setDebugInfo(text);
                  Alert.alert('Data Source Check', text);
                } catch (e: any) {
                  const msg = e?.message ?? 'Unknown error';
                  setDebugInfo(msg);
                  Alert.alert('Check failed', msg);
                }
              }}
              testID="debug-github-urls"
            >
              <Text style={styles.tertiaryBtnText}>Debug: Verify Data Sources</Text>
            </TouchableOpacity>
          </View>
        </View>

        {debugInfo && (
          <View style={styles.debugBox} testID="debug-info-box">
            <Text style={styles.debugText}>{debugInfo}</Text>
          </View>
        )}

        {counts && rows && (
          <>
            <PreviewBlock
              title="Cruises (cruises.xlsx)"
              count={(counts as any).cruises || 0}
              icon="cruises"
              rows={Array.isArray((rows as any).cruises) ? ((rows as any).cruises as any[]) : []}
            />
            <PreviewBlock
              title="Booked (booked.xlsx)"
              count={(counts as any).booked || 0}
              icon="booked"
              rows={Array.isArray((rows as any).booked) ? ((rows as any).booked as any[]) : []}
            />
            <PreviewBlock
              title="Casino Offers (offers.xlsx)"
              count={(counts as any).offers || 0}
              icon="offers"
              rows={Array.isArray((rows as any).offers) ? ((rows as any).offers as any[]) : []}
            />
            <PreviewBlock
              title="Calendar (calendar.ics)"
              count={calCount}
              icon="calendar"
              rows={Array.isArray((rows as any).calendar) ? ((rows as any).calendar as any[]) : []}
            />
            <PreviewBlock
              title="TripIt (tripit.ics)"
              count={tripitCount}
              icon="tripit"
              rows={Array.isArray((rows as any).tripit) ? ((rows as any).tripit as any[]) : []}
            />
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryBtnText: { color: '#111827', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  tertiaryBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tertiaryBtnText: { color: '#111827', fontSize: 13, fontWeight: '600' },
  debugBox: { backgroundColor: '#FFF7ED', borderColor: '#FDBA74', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 12 },
  debugText: { fontSize: 12, color: '#7C2D12' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
  cardCount: { fontSize: 12, color: '#6B7280' },
  emptyText: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  rowItem: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, marginBottom: 6 },
  rowText: { fontSize: 12, color: '#374151' },
  errorText: { color: '#DC2626', marginTop: 8 },
});
