import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { WebView } from 'react-native-webview';
import { injectionScript } from '@/lib/scraper/injection';
import { extractAll } from '@/lib/scraper/extract';
import { exportOffersExcel, exportCruisesExcel } from '@/lib/scraper/excel';
import type { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';

interface LogEntry {
  timestamp: string;
  message: string;
}

export default function ClubRoyaleScraperScreen() {
  const webViewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [hooksInstalled, setHooksInstalled] = useState<boolean>(false);
  const [capturedData, setCapturedData] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [{ timestamp, message }, ...prev].slice(0, 200));
    console.log('[Scraper]', message);
  };

  const isRoyalCaribbean = currentUrl.includes('royalcaribbean.com');

  const handleReload = () => {
    webViewRef.current?.reload();
    addLog('Reloading page...');
  };

  const handleInstallHooks = () => {
    if (!isRoyalCaribbean) {
      Alert.alert('Error', 'Must be on royalcaribbean.com to install hooks');
      return;
    }
    webViewRef.current?.injectJavaScript(injectionScript);
    addLog('Installing hooks...');
  };

  const handleScrape = () => {
    if (!hooksInstalled) {
      Alert.alert('Error', 'Please install hooks first');
      return;
    }
    const scrapeJS = `
      (function() {
        try {
          const result = window.__rn_scrape();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SCRAPED_DATA',
            data: result
          }));
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'ERROR',
            message: e.toString()
          }));
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(scrapeJS);
    addLog('Scraping data...');
  };

  const handleExport = async () => {
    if (capturedData.length === 0) {
      Alert.alert('Error', 'No data to export. Please scrape first.');
      return;
    }

    setIsExporting(true);
    addLog('🔄 Processing data...');

    try {
      const { offers, cruises } = extractAll(capturedData);
      addLog(`✅ Extracted ${offers.length} offers, ${cruises.length} cruises`);

      if (offers.length === 0 && cruises.length === 0) {
        Alert.alert('No Data', 'No offers or cruises found in captured data.');
        setIsExporting(false);
        return;
      }

      addLog('📤 Exporting offers...');
      await exportOffersExcel(offers);
      addLog(`✅ Offers exported (${offers.length} rows)`);

      addLog('📤 Exporting cruises...');
      await exportCruisesExcel(cruises);
      addLog(`✅ Cruises exported (${cruises.length} rows)`);

      Alert.alert(
        'Export Complete',
        `Successfully exported:\n- ${offers.length} offers\n- ${cruises.length} cruises`
      );
    } catch (error) {
      console.error('Export error:', error);
      addLog(`❌ Export failed: ${error}`);
      Alert.alert('Export Failed', `Error: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case 'HOOK_READY':
          setHooksInstalled(true);
          addLog('✅ Hooks installed successfully');
          break;

        case 'SCRAPED_DATA':
          const packets = JSON.parse(message.data);
          setCapturedData(packets);
          addLog(`📦 Captured ${packets.length} packets`);
          break;

        case 'ERROR':
          addLog(`❌ Error: ${message.message}`);
          break;
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Club Royale Scraper',
          headerStyle: { backgroundColor: '#003d82' },
          headerTintColor: '#fff',
        }}
      />
      <View style={styles.container}>
        <View style={styles.controls}>
          <TouchableOpacity style={styles.button} onPress={handleReload}>
            <Text style={styles.buttonText}>Reload</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              !isRoyalCaribbean && styles.buttonDisabled,
            ]}
            onPress={handleInstallHooks}
            disabled={!isRoyalCaribbean}
          >
            <Text style={styles.buttonText}>Install Hooks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              !hooksInstalled && styles.buttonDisabled,
            ]}
            onPress={handleScrape}
            disabled={!hooksInstalled}
          >
            <Text style={styles.buttonText}>Scrape</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              (capturedData.length === 0 || isExporting) && styles.buttonDisabled,
            ]}
            onPress={handleExport}
            disabled={capturedData.length === 0 || isExporting}
          >
            <Text style={styles.buttonText}>
              {isExporting ? 'Exporting...' : 'Export'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.webViewContainer}>
          <WebView
            ref={webViewRef}
            source={{ uri: 'https://www.royalcaribbean.com/club-royale/' }}
            onNavigationStateChange={(navState) => {
              setCurrentUrl(navState.url);
              if (!navState.url.includes('royalcaribbean.com')) {
                setHooksInstalled(false);
              }
            }}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>

        <View style={styles.logContainer}>
          <Text style={styles.logTitle}>Activity Log</Text>
          <ScrollView style={styles.logScroll}>
            {logs.map((log, index) => (
              <Text key={index} style={styles.logEntry}>
                [{log.timestamp}] {log.message}
              </Text>
            ))}
          </ScrollView>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  controls: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  button: {
    flex: 1,
    backgroundColor: '#003d82',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  webViewContainer: {
    flex: 1,
  },
  logContainer: {
    height: 150,
    backgroundColor: '#1e1e1e',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    padding: 8,
  },
  logTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  logScroll: {
    flex: 1,
  },
  logEntry: {
    color: '#00ff00',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});
